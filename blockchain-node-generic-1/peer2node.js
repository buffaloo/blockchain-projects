/*****
*
*  Initial blockchain experiment:
*   - De-centralized network of anonymous peers
*   - Each peer can send coins to the others
*   - Each peer can query the others for their stored blockchain
*   - Each peer needs to 'mine' in order to verify transactions 
*     to be incorporated into the blockchain
*
******/
'use strict'
const express = require('express')
const app = express()
//  var app = new (require('express'))();
const statsRouter = express.Router();
const sha256 = require('js-sha256');
const request = require('request');

var miner_address = 'peer2';
const port = 3001;
var other_address = 'peer1';
var thisNodesTransactions = [];
var peer_nodes = {
	'peer1': 'http://localhost:3000', 
	'peer2': 'http://localhost:3001'
};



var blockChain = [];

class Block {
	
	constructor(index, timestamp, data, previous_hash){
		var self = this;
		self.index = index;
		self.timestamp = timestamp;
		self.data = data;
		self.previous_hash = previous_hash;
		self.hash = self.hashBlock();
	}

	hashBlock() {
		var self = this;
		return sha256(self.index + self.timestamp + JSON.stringify(self.data) + self.previous_hash);
	}

	toJSON() {
		var self = this;
		return {
			index: self.index,
			timestamp: self.timestamp,
			data: self.data,
			previous_hash: self.previous_hash,
			hash: self.hash
		};
	}
}

function createGenesisBlock() {
  return new Block(0, Date.now(), {
    proof_of_work: 9,
    transactions: null,
    createdbynode: port
  }, '0');
}

function findNewChain(callback) {
	// query for the global blockchain
	request(peer_nodes[other_address] + '/blocks', function (error, response, body) {
	if (!error) {
	  var other_chain = JSON.parse(body).map((element) => {
	    return new Block(element.index, element.timestamp, element.data, element.previous_hash);
	  });

	  if (blockChain.length < other_chain.length) {
	    blockChain = other_chain;
	  }
	}

	if (callback) {
	  callback();
	}
	});
}

// look for and sync with the global blockchain variable from other nodes
findNewChain(() => {
	console.log('findNewChain');
	if (blockChain.length == 0) {
		// push the genesis block onto the empty blockchain		
		blockChain.push(createGenesisBlock());
	}
});

//////////////////////////////////////////////////////
//
//  Common Middleware
//
//////////////////////////////////////////////////////

app.get('/', (req, res) => {
	 res.send(`<p>Valid routes are /give, /mine, /blocks. </p>
	 	<p>/give gives 1 coin to the other peer.  </p>
	 	<p>/mine mines 25 coins.  </p>
	 	<p>/blocks get the blockChain currently stored on this node.  </p>
	 	<p>Note: this example allows negative balance. </p>`);
});

app.get('/give', (req, res) => {

  var new_txn = { 
  	'from': miner_address, 
  	'to': other_address, 
  	'amount': 1, 
  	'timestamp': Date.now()
  };

  thisNodesTransactions.push(new_txn);

  res.send(JSON.stringify(thisNodesTransactions));
});

app.get('/blocks', (req, res) => {
	console.log('blocks request ' +  req.get('host') + req.originalUrl);

	  var chainToSend = [];
	  for (var i = 0; i < blockChain.length; i++) {
	    var block = blockChain[i];
	    chainToSend.push(block.toJSON());
	  }
	  res.json(chainToSend);	

//  Jim, why not do this in lieu of the above?
	  //res.json(blockChain.map((block) => {
	  //return block.toJSON();
	//}));
});

app.get('/mine', (req, res) => {
    console.log('mine');  
	findNewChain(() => {

	// create the proof for this block
	var last_block = blockChain[blockChain.length - 1];
	var last_proof = last_block.data.proof_of_work;
	console.log('last_block.data.proof_of_work =' + last_block.data.proof_of_work);
	var proof = proofOfWork(last_proof);

	//  the miner of this block gets to add his newly acquired funds to the block's transactions
	thisNodesTransactions.push({ 
		'from': 'network', 
		'to': miner_address, 
		'amount': 25, 
		'timestamp': Date.now() 
	});

	//  create the new blocks data including proof and transactions
	var new_block_data = {
		proof_of_work: proof,
		transactions: thisNodesTransactions
	};

	thisNodesTransactions = [];    

	//  create the new block
	var new_block_index = last_block.index + 1;
	var new_block_timestamp = Date.now();
	var last_block_hash = last_block.hash;

	var mined_block = new Block(
	new_block_index,
	new_block_timestamp,
	new_block_data,
	last_block_hash
	);

	blockChain.push(mined_block);

	res.json(blockChain.map((block) => {
	return block.toJSON();
	}));

	});
});

function proofOfWork(last_proof) {
	if (Number.isNaN(last_proof))
	{
		console.log("Error in proofOfWork");
		debugger;
	}
	
  var incrementor = last_proof + 1;
  while (incrementor % 9 != 0 || incrementor % last_proof != 0) {
    incrementor += 1;
  }
  return incrementor;
}

//////////////////////////////////////////////////////
//
//  Stats Router Middleware
//
//////////////////////////////////////////////////////

app.use('/stats', statsRouter);        

//  Generic middleware called during each router request
statsRouter.use(function (req, res, next) {
    console.log('see incoming request ' + req.originalUrl);
    next();
});

//  Accessed at GET http://localhost:3000/stats/getblockchain
statsRouter.get('/getblockchain', function (req, res) {
    res.json(blockChain.map((block) => {
      return block.toJSON();
    }));
});

//  Accessed at GET http://localhost:3000/stats/getqraddress
statsRouter.get('/getqraddress', function (req, res) {
	let pageMarkup = '<!DOCTYPE html><html lang="en"><head>';
	let address = "1JvFkfdpYLpqWRnGJ9raRP896V8fMWiqeW";
    let bodyText= '<img src="http://chart.apis.google.com/chart?cht=qr&chs=300x300&chl=' + address + '&chld=H|0" /> ';      
    pageMarkup += '</head><body>' + bodyText + '</body></html>';  
    res.send(pageMarkup);

});

app.listen(port, () => console.log('Example app listening on port ' + port ))
