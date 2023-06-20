import httpproxy from 'http-proxy';
import express from 'express';

const app = express();
const proxy = httpproxy.createProxyServer({});
const SERVER_COUNT = 4;

const HOST = 'localhost';
const PORT = 3000;
const MODE = 'ROUND_ROBIN'
const NUM_REQUESTS_PEWMA = 5;
const TRIP_TIME = 10000;

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
const trips = {}

// Initialize key-value list with server port and connection count
for (const server of servers) {
    serverConnections[server] = 0;
    serverTimings[server] = new Array(NUM_REQUESTS_PEWMA).fill(0);
    totalConnections[server] = 0;
    moving_avgs[server] = 0;
    lastStarts[server] = [];
    trips[server] = new Date(1970, 1, 1);
}

const checkTrip = (port) => {
    console.log("Checking availability of Port: ",port)
    const tripDiff = new Date() - trips[port]
    console.log("It has been ", tripDiff, "since the last Failure")
    return tripDiff < TRIP_TIME
}

const getMinConnections = () => {
    const availableServers = servers.filter(server => !checkTrip(server))
    let bestPort = availableServers[0]
    for (const server of availableServers){
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

    const availableServers = servers.filter(server => !checkTrip(server))
    let bestPort = availableServers[0]
    for (const server of availableServers){
        if (pewma[server] < pewma[bestPort]){
            bestPort = server
        }
    }
    return bestPort
}

const getRoundRobin = () => {
    console.log("ROUND ROBIN")
    let i = 1;
    while(i <= servers.length && checkTrip(PORT + ((nextServer + i) % SERVER_COUNT) + 1)){
        i++;
    }
    nextServer = (nextServer + i) % SERVER_COUNT

    return PORT + nextServer + 1
}

// Function to return a random server port
function findBestServer() {
    switch(MODE){
        case 'FIRST_ONLY':
            return PORT + 1
        case 'RANDOM':
            return PORT + Math.floor(Math.random() * (SERVER_COUNT)) + 1;
        case 'ROUND_ROBIN':
            return getRoundRobin()
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

    if(!checkTrip(nextWorkerPort)){
        serverConnections[nextWorkerPort]++;
        totalConnections[nextWorkerPort]++;
        lastStarts[nextWorkerPort].push(new Date().getTime())

        console.log("Connecting to Server: ", nextWorkerPort)
        proxy.web(req, res, { target: `http://${HOST}:${nextWorkerPort}` });     

        res.on('finish', () => {
            serverConnections[nextWorkerPort]--;
            serverTimings[nextWorkerPort].shift()
            serverTimings[nextWorkerPort].push(new Date().getTime() - lastStarts[nextWorkerPort].shift())
            foundResponses.add(nextWorkerPort)
            if(res.statusCode !== 200){
                console.log("error state")
                trips[nextWorkerPort] = new Date();
            }
            
        });
        
    } else {
        res.status(500).send('Internal server error.')
    }

    
});

app.listen(PORT, () => console.log(`Proxy is listening on port ${PORT}`));
