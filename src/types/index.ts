export interface KexpApiPlayResponse {
  show: number;
  artist: string;
  location_name: string;
  song: string;
  album: string;
  playtype: string;
  release_date: string;
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
