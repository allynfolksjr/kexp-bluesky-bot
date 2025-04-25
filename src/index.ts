import { AtpAgent } from '@atproto/api';
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

let currentShowId: number | undefined;

async function main() {
  try {
    currentShowId = await storage.getItem('currentShowId');
    logger.info(`Current show ID from storage: ${currentShowId}`);
    await agent.login({ identifier: process.env.BLUESKY_USERNAME!, password: process.env.BLUESKY_PASSWORD! })

    logger.info("Fetching song");
    const songResponse = await fetch(
      'https://api.kexp.org/v1/play/?format=json&limit=1',
      {
        headers: {
          'User-Agent': 'kexp-bluesky-bot/0.1 - nikky@uw.edu',
        }
      }
    );
    const body = await songResponse.json() as { results: KexpApiPlayResponse[] };
    const song = body.results[0];
    const showId = song.showid;

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

    // If it's an Air break, don't post anything
    const playType = song.playtype.name;
    if (playType === "Air break") {
      logger.info("Air break, not posting anything");
      return;
    }

    const artistString = song.artist.name;
    const songString = song.track.name;
    const albumString = song.release?.name || "Unknown Album";
    const albumYear = song.releaseevent?.year || "Unknown Year";
    let fullSongString = `“${songString}” ${artistString}`;

    if (albumString !== "Unknown Album") {
      fullSongString += ` — ${albumString}`;
    }

    if (albumYear !== "Unknown Year") {
      fullSongString += ` (${albumYear})`;
    }

    // Get our previous three posts and make sure we don't post the same thing twice
    // Because of radio shows and such, we need to check the last few
    const previousPost = await agent.getTimeline({ limit: 3 });
    const previousPostTexts = previousPost.data.feed.map((post: any) => post.post.record.text);

    if (!previousPostTexts.includes(fullSongString)) {
      await agent.post({
        text: fullSongString
      });
      logger.info("Posted to Bluesky: " + fullSongString);
    } else {
      logger.info("Already posted: " + fullSongString);
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`Error: ${error}`);
    }
  }
}

main();

// Run this on a cron job
const scheduleExpressionMinute = '* * * * *'; // Run once every minute

const job = new CronJob(scheduleExpressionMinute, main);

job.start();
