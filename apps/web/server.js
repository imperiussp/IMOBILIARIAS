const http = require('http');
const next = require('next');
const { parse } = require('url');

const dev = false;
const hostname = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res, parse(req.url, true)))
      .listen(port, hostname, () => {
        console.log(`LENOY IMOBILIARIAS running on port ${port}`);
      });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
