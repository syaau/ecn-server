import fs from 'fs';
import path from 'path';

const root = path.resolve('data');

function getCenters(folder) {
  const files = fs.readdirSync(folder);
  return files
    .filter(f => f.endsWith('.json') && f.split('.').length === 2)
    .map(f => parseInt(f.substring(0, f.length - 5), 10))
    .filter(f => f > 0);
}

function main(districtId) {
  function getDistricts() {
    if (districtId) {
      return [districtId];
    }

    const files = fs.readdirSync(root);
    return files.map(f => parseInt(f, 10)).filter(f => f > 0);
  }

  const districts = getDistricts();
  let count = 0;
  for (let i = 0; i < districts.length; i += 1) {
    const district = districts[i];
    let districtTotal = 0;
    const districtFolder = path.resolve(root, `${district}`);
    const districtInfo = JSON.parse(fs.readFileSync(path.resolve(districtFolder, 'meta.json')));

    for (let j = 0; j < districtInfo.localBodies.length; j += 1) {
      const localBody = districtInfo.localBodies[j];
      const localBodyFolder = path.resolve(districtFolder, `${localBody.id}`);

      const centers = getCenters(localBodyFolder);
      console.log(centers);
      for (let k = 0; k < centers.length; k += 1) {
        const center = centers[k];
        const centerFile = path.resolve(localBodyFolder, `${center}.json`);

        const n = JSON.parse(fs.readFileSync(centerFile)).voters.length;
        console.log(`Total voters in center ${center} of district ${district}: ${n}`);
        districtTotal += n;
      }
    }

    console.log(`Total voters in district ${district}: ${districtTotal}`);
    count += districtTotal;
  }

  console.log(`Total Voters: ${count}`);
}

main(process.argv[2]);
