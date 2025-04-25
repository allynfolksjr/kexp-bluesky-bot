export interface KexpApiPlayResponse {
  playtype: {
    id: number;
    name: string;
  };
  artist: {
    name: string;
  };
  track: {
    name: string;
  };
  release?: {
    name: string;
  };
  releaseevent?: {
    year: string;
  };
  showid: number;
}

export interface KexpApiShowResponse {
  showid: number;
  program: {
    name: string;
    description: string;
  };
  tagline: string;
  hosts: [
    {
      hostid: number;
      name: string;
    }
  ]
}
