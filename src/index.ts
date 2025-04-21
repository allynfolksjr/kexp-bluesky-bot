import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as process from 'process';
import fetch from 'node-fetch';

dotenv.config();

// Create a Bluesky Agent
const agent = new BskyAgent({
  service: 'https://bsky.social',
})

async function main() {
  await agent.login({ identifier: process.env.BLUESKY_USERNAME!, password: process.env.BLUESKY_PASSWORD! })
  // await agent.post({
  //   text: "🙂"
  // });
  console.log("Fetching KEXP Current Playing")

  const response = await fetch('https://api.kexp.org/v1/play/?format=json');
  const body = await response.json() as { results: any[] };
  const song = body.results[0];
  const artistString = song.artist.name;
  const songString = song.track.name;
  const fullSongString = `${artistString} - ${songString}`;

  // Get our previous post and make sure we don't post the same thing twice
  const previousPost = await agent.getTimeline({ limit: 1 });
  const previousPostText = previousPost.data.feed[0].post.record.text;

  if (previousPostText !== fullSongString) {
    await agent.post({
      text: fullSongString
    });
    console.log("Posted to Bluesky: " + fullSongString);
  } else {
    console.log("Already posted: " + fullSongString);
  }
}

main();

// Run this on a cron job
const scheduleExpressionMinute = '* * * * *'; // Run once every minute

const job = new CronJob(scheduleExpressionMinute, main);

job.start();
