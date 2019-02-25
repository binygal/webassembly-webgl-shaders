"use strict"

const http = require("http")
const fs = require("fs")
const url = require("url")

http.createServer((request, response) => {

    let path = url.parse(request.url).pathname
    let data

    path = (path=="/"?"/index.html":path)

    console.log(path)

    if (path.split('.').pop() == "wasm") {
        response.setHeader("Content-Type", 'application/wasm');
    }

    try{
        data = fs.readFileSync(__dirname+path)
    }catch(e){}

    
    response.end(data)

}).listen(1337, () => console.log("Server listening on port 1337"))

