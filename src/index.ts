import { AtpAgent, RichText } from '@atproto/api';
import * as dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as process from 'process';
import fetch from 'node-fetch';
import { KexpApiPlayResponse, KexpApiShowResponse } from './types';

const logger = require('pino')();
const storage = require('node-persist');
storage.initSync();

dotenv.config();

// Create a Bluesky Agent
const agent = new AtpAgent({
  service: 'https://bsky.social',
})

async function main() {
  try {
    await agent.login({ identifier: process.env.BLUESKY_USERNAME!, password: process.env.BLUESKY_PASSWORD! })

    const song = await getSong();

    const showId = song.show;

    // Post the Show
    await postShow(showId);

    // Format the song string
    const fullSongString = formatSongString(song);

    if (fullSongString === '') {
      logger.info("No song to post");
      return;
    }

    // Get our previous three posts and make sure we don't post the same thing twice
    // Because of radio shows and such, we need to check the last few
    const previousPost = await agent.getTimeline({ limit: 5 });
    const previousPostTexts = previousPost.data.feed.map((post: any) => post.post.record.text);

    if (!previousPostTexts.some((postText: string) => postText.includes(fullSongString))) {
      const richTextPost = fullSongPost(fullSongString);
      await agent.post({
        text: richTextPost.text,
        facets: richTextPost.facets,
      });
      logger.info("Posted to Bluesky: " + fullSongString);
    } else {
      logger.info("Already posted: " + fullSongString);
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);

    } else {
      logger.error(`Error: ${error}`);
    }
  }
}

// Create a function to create the full song post
function fullSongPost(songString: string): RichText {
  const richTextPost = new RichText({
    text: songString // + ` — https://kexp.org/listen`
  });
  richTextPost.detectFacets(agent);
  return richTextPost;
}

// Format the response into a song string
function formatSongString(song: KexpApiPlayResponse): string {
  // If it's an Air break, don't post anything
  const playType = song.play_type;
  if (playType === "airbreak") {
    logger.info("Air break, not posting anything");
    return '';
  }

  const artistString = song.artist || "Unknown Artist";
  const songString = song.song || "Unknown Song";
  const albumString = song.album || "Unknown Album";

  // get a year from the release date string
  var releaseYear = null;
  if (song.release_date !== null) {
    const releaseDate = new Date(song.release_date);
    releaseYear = releaseDate.getFullYear();
    if (isNaN(releaseYear)) {
      logger.info("Release year is NaN");
      releaseYear = null;
    }
  }

  let fullSongString = `“${songString}” ${artistString}`;

  if (albumString !== "Unknown Album") {
    fullSongString += ` — ${albumString}`;
  }

  if (releaseYear !== null) {
    fullSongString += ` (${releaseYear})`;
  }

  return fullSongString;
}

async function postShow(showId: number): Promise<void> {
  const currentShowId = await storage.getItem('currentShowId');
  logger.info(`Current show ID from storage: ${currentShowId}`);
  // If the show ID is different from the last one, we need to fetch the show info and post it
  if (showId !== currentShowId) {
    logger.info(`Show ID has changed from ${currentShowId} to ${showId}, fetching new show info`);
    await storage.setItem('currentShowId', showId);

    logger.info("Fetching show");
    const showResponse = await fetch(
      `https://api.kexp.org/v1/show/${showId}/?format=json`,
      {
        headers: {
          'User-Agent': 'kexp-bluesky-bot/0.1 - nikky@uw.edu',
        }
      }
    );
    const showBody = await showResponse.json() as KexpApiShowResponse;

    const showName = showBody.program.name;
    const showTagline = showBody.tagline;
    const showHosts = showBody.hosts;
    const showHostsString = showHosts.map((host) => host.name).join(", ");
    let showString = `Show Starting: “${showName}”`;
    if (showHosts.length > 0) {
      showString += ` with ${showHostsString}`;
    }

    if (showTagline && showTagline.length > 0) {
      showString += `\n\n ${showTagline}`;
    }

    logger.info(showString);
    await agent.post({
      text: showString
    });
  } else {
    logger.info(`Show ID has not changed, current show ID: ${currentShowId}`);
  }
}

async function getSong(): Promise<KexpApiPlayResponse> {
  logger.info("Fetching song");
  // Bay Area is location 2
  const songResponse = await fetch(
    'https://api.kexp.org/v2/plays/?format=json&playlist_location=3&limit=3',
    {
      headers: {
        'User-Agent': 'kexp-bluesky-bot/0.1 - nikky@uw.edu',
      }
    }
  );
  const body = await songResponse.json() as { results: KexpApiPlayResponse[] };
  const song = body.results[0];
  return song;
}

main();

// Run this on a cron job
const scheduleExpressionMinute = '* * * * *'; // Run once every minute

const job = new CronJob(scheduleExpressionMinute, main);

job.start();
