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
    getFiles(client, 0, [], (err, files) => {
      if (err) {
        console.log(err);
        client.close();
        process.exit(0);
      }
      console.log(
        `Overall: ${files.length} file(s), space: ${getSpace(files)}GB`
      );
      let expiredFiles = files.filter(
        (file) => Date.parse(file.modifiedAt) < minFileDateStamp
      );
      if (expiredFiles.length === 0) {
        console.log(`Didnt find any files to delete.`);
        process.exit(0);
      }
      expiredFiles.map((file) => console.log(file.path));
      console.log(
        `Found ${expiredFiles.length} old file(s), space: ${getSpace(
          expiredFiles
        )}GB`
      );
      let expiredFilesPaths = expiredFiles.map((file) => file.path);
      rl.setPrompt("Do you want to delete these files? y/n:   ");
      rl.prompt();
      rl.on("line", function (line) {
        line = line.trim().toLowerCase();
        if (line !== "y") {
          console.log("Finished, didnt delete any file(s).");
          client.close();
          process.exit(0);
        } else {
          let length = expiredFilesPaths.length;
          deleteFiles(client, expiredFilesPaths, () => {
            if (err) {
              console.log(err);
              client.close();
              process.exit(0);
            } else {
              console.log(`Deleted ${length} old file(s)`);
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

function getFiles(client, index, results, callback) {
  if (index === directories.length) {
    callback(null, results);
    return;
  }
  client
    .list(directories[index])
    .then((res) => {
      res.map((file) => {
        file.path = `${directories[index]}/${file.name}`;
      });
      results = results.concat(res);
      getFiles(client, index + 1, results, callback);
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

function getSpace(files) {
  let space = files.reduce((prev, curr) => prev + curr.size, 0);
  return parseFloat(space / 1000000000).toFixed(2);
}
