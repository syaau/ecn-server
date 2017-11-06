import path from 'path';
import fs from 'fs';
import {
  getDistricts, getLocalBodies, getWards, getCenters, getVoterList,
} from 'scraper-ecn';

import createQueue from '../lib/createQueue';

function createDir(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
  return folder;
}

/**
 * Extract Data from the ECN server and store in dynamodb
 */
async function main() {
  const districts = await getDistricts();
  const queue = createQueue(16);

  const root = createDir(path.resolve('data'));
  districts.forEach(async (district) => {
    const districtFolder = createDir(path.resolve(root, district.id));
    const localBodies = await queue(() => getLocalBodies(district.id));
    fs.writeFileSync(path.resolve(districtFolder, 'meta.json'), JSON.stringify({
      ...district,
      localBodies,
    }));
    localBodies.forEach(async (localBody) => {
      const localBodyFolder = createDir(path.resolve(districtFolder, localBody.id));
      const wards = await queue(() => getWards(localBody.id));
      fs.writeFileSync(path.resolve(localBodyFolder, 'meta.json'), JSON.stringify({
        ...localBody,
        wards: wards.map(w => w.number),
      }));
      wards.forEach(async (ward) => {
        const centers = await queue(() => getCenters(localBody.id, ward.number));
        centers.forEach(async (center) => {
          try {
            const info = await queue(() => getVoterList(district.id, localBody.id, ward.number, center.id));
            fs.writeFileSync(path.resolve(localBodyFolder, `${center.id}.json`), JSON.stringify({
              ...center,
              voters: info,
            }));
          } catch (err) {
            console.log(`Error retreiving center info District: ${district.id}, Local: ${localBody.id}, Ward: ${ward.number}, Center: ${center.id}`);
            const info = await queue(() => getVoterList(district.id, localBody.id, ward.number, center.id));
            fs.writeFileSync(path.resolve(localBodyFolder, `${center.id}.json`), JSON.stringify({
              ...center,
              voters: info,
            }));
          }
        });
      });
    });
  });
}

main();
