const ftp = require("basic-ftp");

const config = require("./config.json");

const dryRun = process.argv[2] === "--dry"; //arg

const directories = config.directories; //remote dirs
const minFileDateStamp = Date.now() - config.expirationTime; //min modified timestamp

exec();

async function exec() {
  const client = new ftp.Client(0);
  client.ftp.verbose = false;
  try {
    await client.access(config.ftp);
    getExpiredFiles(client, 0, [], (err, results) => {
      if (err) {
        console.log(err);
        client.close();
        return;
      }
      let paths = getPathArray(results);
      let space = getFreeSpace(results);
      console.log(`Found ${paths.length} old file(s), space: ${space}GB`);
      if (dryRun) {
        console.log("Finished DryRun, didnt delete any file(s).");
        client.close();
      } else {
        deleteFiles(client, paths, () => {
          if (err) {
            console.log(err);
            client.close();
          } else {
            console.log(`Deleted ${paths.length} old file(s)`);
            client.close();
          }
        });
      }
    });
  } catch (err) {
    console.log(err);
    client.close();
    return;
  }
}

function getExpiredFiles(client, index, results, callback) {
  if (index === directories.length) {
    callback(null, results);
    return;
  }
  client
    .list(directories[index])
    .then((res) => {
      res = res.filter(
        (file) => Date.parse(file.modifiedAt) < minFileDateStamp
      );
      results.push(res);
      getExpiredFiles(client, index + 1, results, callback);
    })
    .catch((err) => {
      callback(err);
    });
}

function deleteFiles(client, paths, callback) {
  if (paths.length === 0) {
    callback(null);
    return;
  }
  client
    .remove(paths.pop())
    .then(() => {
      deleteFiles(client, paths, callback);
    })
    .catch((err) => {
      callback(err);
    });
}

function getPathArray(toDelete) {
  const paths = [];
  toDelete.map((arr, index) => {
    arr.map((file) => {
      paths.push(`${directories[index]}/${file.name}`);
    });
  });
  return paths;
}

function getFreeSpace(toDelete) {
  let freeSpace = 0;
  toDelete.map((arr) => {
    arr.map((file) => {
      freeSpace += file.size;
    });
  });
  return parseFloat(freeSpace / 1000000000).toFixed(2);
}
