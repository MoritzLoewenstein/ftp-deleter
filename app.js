const ftp = require("basic-ftp");
const readline = require("readline");

const config = require("./config.json");

const rl = readline.createInterface(process.stdin, process.stdout);

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
        process.exit(0);
      }
      let paths = getPathArray(results);
      let space = getFreeSpace(results);
      if (paths.length === 0) {
        console.log(`Didnt find any files to delete.`);
        process.exit(0);
      }
      paths.map((path) => console.log(path));
      console.log(`Found ${paths.length} old file(s), space: ${space}GB`);

      rl.setPrompt("Do you want to delete these files? y/n:   ");
      rl.prompt();
      rl.on("line", function (line) {
        line = line.trim().toLowerCase();
        if (line !== "y") {
          console.log("Finished, didnt delete any file(s).");
          client.close();
          process.exit(0);
        } else {
          deleteFiles(client, paths, () => {
            if (err) {
              console.log(err);
              client.close();
              process.exit(0);
            } else {
              console.log(`Deleted ${paths.length} old file(s)`);
              client.close();
              process.exit(0);
            }
          });
        }
      }).on("close", function () {
        process.exit(0);
      });
    });
  } catch (err) {
    console.log(err);
    client.close();
    process.exit(0);
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
  let deleting = paths.pop();
  client
    .remove(deleting)
    .then(() => {
      console.log(`deleted ${deleting}`);
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
