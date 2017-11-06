/**
 * Create a queueing method for promises to limit the number of
 * executing promises. Keeping the other promises in queue to
 * run later
 *
 * @param {number} concurrent Number of concurrently running promises
 */
export default function createQueue(concurrent = 8) {
  let running = 0;
  const fnQueue = [];

  return function queue(fn) {
    return new Promise((resolve, reject) => {
      const execute = () => {
        running += 1;
        fn().then((res) => {
          running -= 1;

          if (fnQueue.length > 0) {
            fnQueue.shift()();
          }
          resolve(res);
        }).catch((err) => {
          running -= 1;

          if (fnQueue.length > 0) {
            fnQueue.shift()();
          }
          reject(err);
        });
      };

      if (running >= concurrent) {
        fnQueue.push(execute);
      } else {
        execute();
      }
    });
  };
}