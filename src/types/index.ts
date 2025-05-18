export interface KexpApiPlayResponse {
  show: number;
  artist: string | null;
  location_name: string | null;
  song: string | null;
  album: string | null;
  playtype: string | null;
  release_date: string | null;
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
