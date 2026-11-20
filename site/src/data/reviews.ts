export type Review = {
  id: string;
  quote: string;
  name: string;
  handle?: string;
  source: string;
  url: string;
  date: string;
};

/**
 * Only real, verifiable entries belong here, with a public source URL.
 * The site hides the section entirely while this list is empty.
 */
export const reviews: Review[] = [];
