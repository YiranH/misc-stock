import { NextRequest, NextResponse } from 'next/server';

const recommendBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['objective'],
  properties: {
    objective: {
      type: 'string',
      minLength: 3,
      maxLength: 160,
      description: "User's investment objective",
    },
    risk_tolerance: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      description: 'How comfortable the investor is with market ups and downs',
    },
    horizon_years: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      default: 5,
      description: 'Years the investor plans to stay invested before needing the money',
    },
    constraints: {
      $ref: '#/components/schemas/RecommendConstraints',
      description: 'Optional portfolio rules',
    },
  },
};

const recommendationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'objective',
    'risk_tolerance',
    'horizon_years',
    'portfolio',
  ],
  properties: {
    version: { const: '1', type: 'string' },
    objective: { type: 'string' },
    risk_tolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
    horizon_years: { type: 'integer', minimum: 1, maximum: 50 },
    constraints: {
      type: 'object',
      additionalProperties: false,
      properties: {
        exclude: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
        max_single_weight: {
          type: 'number',
          default: 40,
        },
      },
      default: {},
    },
    portfolio: {
      type: 'array',
      items: { $ref: '#/components/schemas/Position' },
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
    disclaimers: {
      type: 'array',
      items: { type: 'string' },
      default: ['This is not financial advice. Do your own research.'],
    },
  },
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const document = {
    openapi: '3.1.0',
    info: {
      title: 'Portfolio Recommender API',
      version: '1.0.0',
      description:
        'Generate diversified investment portfolios tailored to user objectives and risk preferences.',
    },
    servers: [{ url: origin }],
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/api/recommend': {
        post: {
          summary: 'Generate a portfolio recommendation',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecommendBody' },
              },
            },
          },
          responses: {
            200: {
              description: 'Portfolio recommendation',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Recommendation' },
                },
              },
            },
            400: { description: 'Validation error' },
            401: { description: 'Unauthorized' },
            500: { description: 'Missing LLM credentials' },
            502: { description: 'LLM provider error' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      schemas: {
        RecommendBody: recommendBodySchema,
        Recommendation: recommendationSchema,
        Position: {
          type: 'object',
          additionalProperties: false,
          required: ['symbol', 'name', 'asset_class', 'weight', 'rationale'],
          properties: {
            symbol: { type: 'string' },
            name: { type: 'string' },
            asset_class: {
              type: 'string',
              enum: ['ETF', 'Stock', 'Bond', 'Cash', 'Other'],
            },
            weight: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            rationale: { type: 'string', maxLength: 600 },
          },
        },
        RecommendConstraints: {
          type: 'object',
          additionalProperties: false,
          properties: {
            exclude: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 60,
              },
              description: 'Tickers or themes to avoid',
            },
            max_single_weight: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description:
                'Cap any single holding at a percentage of the total portfolio',
            },
          },
        },
      },
    },
  };

  return NextResponse.json(document);
}
