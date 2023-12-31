import httpproxy from 'http-proxy';
import express from 'express';

const app = express();
const proxy = httpproxy.createProxyServer({});
const SERVER_COUNT = 4;

const HOST = 'localhost';
const PORT = 3000;
const MODE = 'LEAST_CONNECTIONS'
const NUM_REQUESTS_PEWMA = 5;

//logging vars
const totalConnections = {};

//Round Robin vars
let nextServer = 0

//Least Connections vars
const serverConnections = {};

//Least Time vars
const serverTimings = {};
const moving_avgs = {}
const lastStarts = {}
const foundResponses = new Set()

// Create list of server ports
let servers = [];
for (let i = 1; i <= SERVER_COUNT; i++) {
    servers.push(PORT + i);
}

// Initialize key-value list with server port and connection count
for (const server of servers) {
    serverConnections[server] = 0;
    serverTimings[server] = new Array(NUM_REQUESTS_PEWMA).fill(0);
    totalConnections[server] = 0;
    moving_avgs[server] = 0;
    lastStarts[server] = [];
}

const getMinConnections = () => {
    let bestPort = PORT + 1
    for (const server of servers){
        if (serverConnections[server] < serverConnections[bestPort]){
            bestPort = server
        }
    }
    return bestPort
}

const getMinTime = () => {

    const pewma = {}

    for (const server of servers) {
        if(foundResponses.has(server)){
            moving_avgs[server] = serverTimings[server].reduce((avg, time) =>
                (avg + time) * 0.5
            )
        }
        pewma[server] = moving_avgs[server] * serverConnections[server]
    }
    console.log("pewma")
    console.log(pewma)

    let bestPort = PORT + 1
    for (const server of servers){
        if (pewma[server] < pewma[bestPort]){
            bestPort = server
        }
    }
    return bestPort
}

// Function to return a random server port
function findBestServer() {
    switch(MODE){
        case 'FIRST_ONLY':
            return PORT + 1
        case 'RANDOM':
            return PORT + Math.floor(Math.random() * (SERVER_COUNT)) + 1;
        case 'ROUND_ROBIN':
            nextServer = (nextServer + 1) % SERVER_COUNT
            return PORT + nextServer + 1
        case 'LEAST_CONNECTIONS':
            return getMinConnections()
        case 'LEAST_TIME':
            return getMinTime()

    }

}

app.use('/', (req, res) => {
    console.log("previous connections:")
    console.log(serverConnections)

    console.log("total connections:")
    console.log(totalConnections)

    let nextWorkerPort = findBestServer();
    console.log("chosen server: " + nextWorkerPort)

    serverConnections[nextWorkerPort]++;
    totalConnections[nextWorkerPort]++;
    lastStarts[nextWorkerPort].push(new Date().getTime())
    proxy.web(req, res, { target: `http://${HOST}:${nextWorkerPort}` });

    res.on('finish', () => {
        serverConnections[nextWorkerPort]--;
        serverTimings[nextWorkerPort].shift()
        serverTimings[nextWorkerPort].push(new Date().getTime() - lastStarts[nextWorkerPort].shift())
        foundResponses.add(nextWorkerPort)
    });
});

app.listen(PORT, () => console.log(`Proxy is listening on port ${PORT}`));
