import fs from 'fs';
import path from 'path';
import { getVoterInfo } from 'scraper-ecn';

import createQueue from '../lib/createQueue';

const root = path.resolve('data');
const queue = createQueue(32);

function getFiles(folder) {
  return new Promise((resolve, reject) => {
    fs.readdir(folder, (err, res) => {
      if (err) {
        return reject(err);
      }

      return resolve(res);
    });
  });
}

async function saveVoterInfo(centerFolder, id) {
  const imgFile = path.resolve(centerFolder, `${id}.jpg`);
  const voterFile = path.resolve(centerFolder, `${id}.json`);

  if (fs.existsSync(voterFile)) {
    return;
  }

  let detail = null;
  try {
    detail = await queue(() => getVoterInfo(id));
  } catch (err) {
    detail = await queue(() => getVoterInfo(id));
  }

  const { image, ...other } = detail;

  // Save the file content
  fs.writeFileSync(voterFile, JSON.stringify(other));

  // Save the image file
  fs.writeFileSync(imgFile, image);
}

async function processCenter(folder, centerId) {
  const processedFile = path.resolve(folder, `${centerId}.processed.json`);
  if (fs.existsSync(processedFile)) {
    return JSON.parse(fs.readFileSync(processedFile)).total;
  }

  const centerFolder = path.resolve(folder, `${centerId}`);
  if (!fs.existsSync(centerFolder)) {
    fs.mkdirSync(centerFolder);
  }

  const info = JSON.parse(fs.readFileSync(path.resolve(folder, `${centerId}.json`)));
  let count = 0;
  for (let i = 0; i < info.voters.length; i += 1) {
    const voter = info.voters[i];

    try {
      await saveVoterInfo(centerFolder, voter.id);
      count += 1;
    } catch (e) {
      console.log('Failed to save voter Info for', voter.id, e.message);
    }
  }

  fs.writeFileSync(processedFile, JSON.stringify({
    total: count,
  }));

  return count;
}

async function processLocalBody(folder, id) {
  const localBodyFolder = path.resolve(folder, `${id}`);
  const processedFile = path.resolve(localBodyFolder, 'processed.json');
  if (fs.existsSync(processedFile)) {
    return JSON.parse(fs.readFileSync(processedFile)).total;
  }

  const files = await getFiles(localBodyFolder);
  const centers = files
    .filter(f => f.endsWith('.json'))
    .map(f => parseInt(f.substring(0, f.length - 5), 10))
    .filter(f => f > 0 && f < 100000);

  let count = 0;
  for (let i = 0; i < centers.length; i += 1) {
    const center = centers[i];
    count += await queue(() => processCenter(localBodyFolder, center));
  }

  fs.writeFileSync(processedFile, JSON.stringify({
    total: count,
  }));

  return count;
}

async function processDistrict(folder, id) {
  const dirFolder = path.resolve(folder, `${id}`);
  const processedFile = path.resolve(dirFolder, 'processed.json');
  if (fs.existsSync(processedFile)) {
    return JSON.parse(fs.readFileSync(processedFile)).total;
  }

  const info = JSON.parse(fs.readFileSync(path.resolve(dirFolder, 'meta.json')));
  let count = 0;
  for (let i = 0; i < info.localBodies.length; i += 1) {
    const localBody = info.localBodies[i];
    count += await queue(() => processLocalBody(dirFolder, localBody.id, id));
  }

  fs.writeFileSync(processedFile, JSON.stringify({
    total: count,
  }));

  return count;
}

async function main(districtId) {
  // Go through all the districts
  let count = 0;

  async function getDistricts() {
    if (districtId) {
      return [districtId];
    }

    const files = await getFiles(root);
    const districts = files.map(f => parseInt(f, 10)).filter(d => (d > 0 && d < 80));
    return districts;
  }

  const districts = await getDistricts();
  for (let i = 0; i < districts.length; i += 1) {
    const district = districts[i];
    const dCount = await queue(() => processDistrict(root, district));
    count += dCount;
    console.log(i + 1, 'District', district, 'Voters: ', `${dCount}. Total so far: ${count}`);
  }

  console.log('Total voters', count);
}

main(process.argv[2]);
