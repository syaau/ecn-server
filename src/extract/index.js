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
async function main(districtId) {
  async function districts() {
    if (districtId) {
      return [districtId];
    }

    const res = await getDistricts();
    return res.map(d => d.id);
  }


  const queue = createQueue(16);
  const root = createDir(path.resolve('data'));
  const list = await districts();
  list.forEach(async (id) => {
    const districtFolder = createDir(path.resolve(root, id));
    const localBodies = await queue(() => getLocalBodies(id));
    fs.writeFileSync(path.resolve(districtFolder, 'meta.json'), JSON.stringify({
      id,
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
            const info = await queue(() => getVoterList(id, localBody.id, ward.number, center.id));
            fs.writeFileSync(path.resolve(localBodyFolder, `${center.id}.json`), JSON.stringify({
              ...center,
              voters: info,
            }));
          } catch (err) {
            console.log(`Error retreiving center info District: ${id}, Local: ${localBody.id}, Ward: ${ward.number}, Center: ${center.id}`);
            const info = await queue(() => getVoterList(id, localBody.id, ward.number, center.id));
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

main(process.argv[2]);
