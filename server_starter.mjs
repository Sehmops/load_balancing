import { spawn } from "child_process";
import { createInterface } from "readline";
import { exit } from "process";

// Define port and amount of servers
const BASE_PORT = 3001;
const SERVER_COUNT = 4;

// Start server processes and give them their individual port
const processes = [];
for (let i = 0; i < SERVER_COUNT; i++) {
    const port = BASE_PORT + i;
    const process = spawn("node", ["./server.mjs", port]);
    processes.push(process);
}


// Prepare method to kill all server instances with one key press
const rlInterface = createInterface(process.stdin, process.stdout);
 
rlInterface.question("Press enter to exit", () => {
    console.log("exiting");
    for (const process of processes) {
        process.kill();
    }
    exit();
});
