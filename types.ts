export type Quote = {
  symbol: string; name: string;
  sector: string; industry: string;
  marketCap: number;
  changePct: number;
  last: number;
  spark: number[];
};

export type NodeDatum = {
  name: string;
  children?: NodeDatum[];
  data?: Quote;
};
