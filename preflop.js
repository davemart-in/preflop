"use strict";
// Check to make sure global namespace for PokerBot (PB) is not already being used
// Set an empty object if it's not
if (!window.PB) {
	window.PB = {};
}
window.PB.Core = function () {
	// -------------------------------------------------------------
	// PRIVATE VARS
	// -------------------------------------------------------------
	const debug = true;
	let gameState = setupInitializeGameState();
	// -------------------------------------------------------------
	// PRIVATE ANALYSIS (CARD AND HAND) FUNCTIONS
	// -------------------------------------------------------------
	function analysisEvaluateHand(hand) {
		// Evaluate the hand
		const handValue = PokerEvaluator.evalHand(hand);
		return handValue;
	}
	function analysisGetHandStrength(hand) {
		const handValue = analysisEvaluateHand(hand);
		return handValue.handRank;
	}
	function analysisHandStrengthVisualization(hand) {
		// Code for visualizing hand strength using a library or custom implementation
	}
	// -------------------------------------------------------------
	// PRIVATE PRE-FLOP DECISION MAKING FUNCTIONS
	// -------------------------------------------------------------
	function preFlopDecision(myPosition) {
		// Get the optimal pre-flop hand ranges for each position type
		let optimalRanges = preFlopGetOptimalHandRanges();
		// Get the player's hand range based on their hole cards
		let playerHandRange = preFlopGetPlayerHandRange(gameState.players[myPosition]);
		// Get an array of actions taken by players before the current player
		let actionsBeforeMe = preFlopPlayerActionsBeforeMe(gameState, myPosition);
		// Calculate the effective stack size of the current player
		let effectiveStackSize = preFlopEffectiveStackSize(gameState, myPosition);
		// Calculate the pot odds for the current player's decision
		let potOdds = preFlopPotOdds(gameState, myPosition);
		// Calculate the expected value of the current player's decision
		let expectedValue = preFlopExpectedValue(gameState, myPosition);
		// Determine the position type of the current player (early, middle, or late position)
		let myPositionType = setupGetMyPositionType(myPosition, gameState.players.length);
		// Get the optimal hand range for the current player's position type
		let optimalRange = optimalRanges[myPositionType];
		// If the expected value is positive and the player's hand is in the 'raise' or 'reraise' range...
		if (expectedValue > 0 && (playerHandRange.raise.includes(gameState.players[myPosition].cards) || playerHandRange.reraise.includes(gameState.players[myPosition].cards))) {
			// If there's a raise before the current player and their hand is in the 'reraise' range, return 'reraise'
			if (actionsBeforeMe.some(action => action === 'raise') && playerHandRange.reraise.includes(gameState.players[myPosition].cards)) {
				return 'reraise';
			} else {
				// Otherwise, return 'raise'
				return 'raise';
			}
		} else if (expectedValue > 0 && playerHandRange.call.includes(gameState.players[myPosition].cards)) {
			// If the expected value is positive and the player's hand is in the 'call' range, return 'call'
			return 'call';
		} else {
			// If none of the above conditions are met, return 'fold'
			return 'fold';
		}
	}
	function preFlopEffectiveStackSize(gameState, myPosition) {
		let myStackSize = gameState.players[myPosition].stackSize;
		let effectiveStackSize = myStackSize;

		for (let i = 0; i < gameState.players.length; i++) {
			if (i === myPosition) continue;

			let otherStackSize = gameState.players[i].stackSize;

			if (otherStackSize < effectiveStackSize) {
				effectiveStackSize = otherStackSize;
			}
		}
		return effectiveStackSize;
	}
	function preFlopExpectedValue(gameState, myPosition) {
		let potOdds = preFlopPotOdds(gameState, myPosition);
		let handStrength = analysisGetHandStrength(gameState.players[myPosition].cards);

		if (potOdds === "No action required") {
			return "No action required";
		}

		let expectedValue = handStrength * (gameState.potSize + gameState.players[myPosition].amountToCall) - gameState.players[myPosition].amountToCall;
		return expectedValue;
	}
	function preFlopGetLooseHandRanges() {
		const handRanges = {
			earlyPosition: {
				raise: "22+ A2s+ K9s+ Q9s+ J9s+ T8s+ 97s+ 86s+ 75s+ 64s+ 53s+ A7o+ K9o+ Q9o+ J9o+ T9o",
				reraise: "AA-QQ A5s",
				call: "QQ-22 ATs+ KTs+ QTs+ JTs-76s AKo"
			},
			cutoff: {
				raise: "22+ A2s+ K7s+ Q7s+ J7s+ T7s+ 96s+ 85s+ 74s+ 63s+ 53s+ A2o+ K8o+ Q8o+ J8o+ T8o",
				reraise: "JJ+ AKs-ATs A5s-A2s KQs-KJs QJs JTs 97s 87s 54s AKo-AQo",
				call: "TT-22 AQs-A8s A6s K9s+ Q9s+ JTs 98s 76s-65s J9s-86s AQo-AJo KQo"
			},
			button: {
				raise: "22+ A2s+ K2s+ Q4s+ J6s+ T6s+ 95s+ 84s+ 73s+ 62s+ 52s+ A2o+ K5o+ Q7o+ J8o+ T8o",
				reraise: "99+ AKs-ATs A5s-A2s KQs-KJs QJs JTs 97s 75s AKo-AQo",
				call: "88-22 A9s-A6s KTs-K9s QTs-Q9s J9s-T9s 86s-75s 64s-53s J8s-T7s AJo-ATo KQo-KJo"
			},
			blinds: {
				reraise: "AA-KK A5s",
				call: "QQ-22 ATs+ KTs+ QTs+ JTs-76s AKo"
			}
		};
		return handRanges;
	}
	function preFlopGetOptimalHandRanges() {
		// Adheres to Ed Millers recommendations for optimal hand ranges
		const handRanges = {
			earlyPosition: {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
				call: []
			},
			cutoff: {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QTs', 'Q9s', 'JTs', 'T9s', '98s', '87s', '76s', '65s'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: []
			},
			button: {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QTs', 'Q9s', 'JTs', 'T9s', '98s', '87s', '76s', '65s'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: ['66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'K8s', 'K7s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '64s', '53s', '43s']
			},
			blinds: {
				raise: [],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', '        AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: ['88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'K8s', 'K7s', 'Q9s', 'J9s', 'T9s', '98s', '87s', '76s', '65s', '54s']
			}
		};
		return handRanges;
	}
	function preFlopGetPlayerHandRange(player) {
		let handRange;
		switch (player.type) {
			case 'optimal':
				handRange = preFlopGetOptimalHandRanges()[player.position];
				break;
			case 'loose':
				handRange = preFlopGetLooseHandRanges()[player.position];
				break;
			case 'tight':
				handRange = preFlopGetTightHandRanges()[player.position];
				break;
			default:
				console.error('Invalid player type:', player.type);
				break;
		}
		return handRange;
	}
	function preFlopGetTightHandRanges() {
		const handRanges = {
			earlyPosition: {
				raise: "22+ AJs+ KQs AKo",
				reraise: "AA-QQ",
				call: "QQ-22 ATs+ KTs+ QTs+ JTs AKo"
			},
			cutoff: {
				raise: "22+ A9s+ KTs+ QTs+ JTs AKo+",
				reraise: "JJ+ AKs",
				call: "TT-22 AQs-A9s KJs-KTs QJs"
			},
			button: {
				raise: "22+ ATs+ KTs+ QTs+ JTs A9o+ KTo+ QJo",
				reraise: "99+ AKs-ATs A5s-A2s KQs-KJs QJs JTs 97s 87s 54s AKo-AQo",
				call: "88-22 A8s-A6s K9s-KTs Q9s-QTs J9s-JTs T9s 98s 87s 76s A8o-A6o K9o Q9o J9o T9o 98o"
			},
			blinds: {
				reraise: "AA-QQ AKs",
				call: "QQ-22 ATs+ KTs+ QTs+ JTs AKo"
			}
		};
		return handRanges;
	}
	function preFlopPlayerActionsBeforeMe(gameState, myPosition) {
		let actionsBeforeMe = [];
		for (let i = 0; i < myPosition; i++) {
			const player = gameState.players[i];
			const hand = player.hand;
			const playerType = player.playerType;
			const handRange = preFlopGetPlayerHandRange(playerType);
			const action = preFlopDecideAction(hand, handRange);

			actionsBeforeMe.push({
				playerId: i,
				playerType: playerType,
				action: action,
				hand: hand
			});
		}
		return actionsBeforeMe;
	}
	function preFlopPotOdds(gameState, myPosition) {
		let potSize = gameState.potSize;
		let amountToCall = gameState.players[myPosition].amountToCall;

		if (amountToCall === 0) {
			return "No action required";
		}

		let potOdds = amountToCall / (potSize + amountToCall);
		return potOdds;
	}
	// -------------------------------------------------------------
	// PRIVATE SETUP FUNCTIONS
	// -------------------------------------------------------------
	function setupCreateDeck() {
		// Create a deck of 52 cards
		const suits = ['c', 'd', 'h', 's'];
		const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
		const deck = [];
		for (const suit of suits) {
			for (const rank of ranks) {
				deck.push(rank + suit);
			}
		}
		return deck;
	}
	function setupCreatePlayers(numPlayers) {
		// Validate that we have 2-10 players
		if (numPlayers < 2 || numPlayers > 10) {
			alert('Invalid number of players');
			return false;
		}
		if (debug) { console.log("Number of Players: ", numPlayers); }
		// Create an array of players
		const primaryPlayer = document.querySelector('.player-primary');
		const players = [];
		let html = '';
		for (let i = 0; i < numPlayers; i++) {
			const playerId = i;
			const playerType = (i === 0) ? 'optimal' : setupGetPlayerType();
			const stackSize = Math.floor(Math.random() * (250 - 50 + 1) + 50);
			players.push({
				id: playerId,
				type: playerType,
				stackSize: stackSize,
				hand: []
			});
			// Not applicable to primary player
			if (i === 0) {
				// Add players to DOM
				primaryPlayer.innerHTML = _tmpl('playerZero', {
					stackSize: stackSize
				});
			} else {
				// Add players to DOM
				html += _tmpl('player', {
					playerId: playerId,
					stackSize: stackSize
				});
			}
		}
		// Insert html after .player-primary
		primaryPlayer.insertAdjacentHTML('afterend', html);
		// Return the array of players
		return players;
	}
	function setupDealCards() {
		// Make a copy of the shuffled deck
		let deck = gameState.deck;
		// Burn the first card
		deck.shift();
		// Deal the first card to each player, then second card to each player
		for (let i = 0; i < 2; i++) {
			for (let i = 0; i < gameState.players.length; i++) {
				gameState.players[i].hand.push(deck.shift());
			}
		}
		// Populate primary players cards src property
		document.getElementById('card1').src = 'img/' + gameState.players[0].hand[0] + '.png';
		document.getElementById('card2').src = 'img/' + gameState.players[0].hand[1] + '.png';
	}
	function setupGetButtonPosition() {
		// If the button position is not set, set it to a random position
		if (gameState.buttonPosition === undefined) {
			// Randomly assign the button position
			return gameState.buttonPosition = Math.floor(Math.random() * gameState.players.length);
		}
		// Otherwise, increment the button position
		return gameState.buttonPosition = (gameState.buttonPosition + 1) % gameState.players.length;
	}
	function setupGetMyPositionType(position, totalPlayers) {
		if (position <= totalPlayers * 0.4) {
			return 'early';
		} else if (position <= totalPlayers * 0.7) {
			return 'cutoff';
		} else if (position <= totalPlayers * 0.9) {
			return 'button';
		} else {
			return 'blinds';
		}
	}
	function setupGetPlayerType() {
		const playerTypes = ["loose", "tight", "optimal"];
		return playerTypes[Math.floor(Math.random() * playerTypes.length)];
	}
	function setupInit() {
		// Generate players
		gameState.players = setupCreatePlayers(prompt("Enter the number of players (2-10): "));
		if (debug) { console.log("Players Created: ", gameState.players); }
		// If player count is off, don't continue
		if (!gameState.players) {
			return;
		}
		// Generate deck
		gameState.deck = setupCreateDeck();
		if (debug) { console.log("Deck Created: ", gameState.deck); }
		// Shuffle deck
		setupShuffleDeck();
		if (debug) { console.log("Deck Shuffled: ", gameState.deck); }
		// Deal cards
		setupDealCards();
		if (debug) { console.log("Cards Dealt: ", gameState.players); }
		// Get starting button position
		gameState.buttonPosition = setupGetButtonPosition();
		if (debug) { console.log("Button Position: ", gameState.buttonPosition); }
		// Add button to the right player
		document.querySelector('.player-' + gameState.buttonPosition).classList.add('button');
		// Events
		setupRegisterEvents();
	}
	function setupInitializeGameState() {
		return {
			deck: [],
			players: [],
			positionCounts: {
				early: 0,
				cutoff: 0,
				button: 0,
				blinds: 0
			}
		};
	}
	function setupRegisterEvents() {
		// Call button
		document.getElementById('call').addEventListener('click', function () {
			// Call action
		}, { once: true });
		// Fold button
		document.getElementById('fold').addEventListener('click', function () {
			// Fold action
		}, { once: true });
		// Raise button
		document.getElementById('raise').addEventListener('click', function () {
			// Raise action
		}, { once: true });
		// Reset button
		document.getElementById('reset').addEventListener('click', function () {
			setupResetGame();
		}, { once: true });
		// Show hands button
		document.getElementById('show').addEventListener('click', function () {
			// Show hands
		}, { once: true });
	}
	function setupResetGame() {
		if (debug) { console.log('-----'); console.log('RESET'); console.log('-----'); }
		// Remove button position
		gameState.buttonPosition = undefined;
		document.querySelector('.player.button').classList.remove('button');
		// Show all players
		document.querySelectorAll('.player-other').forEach(function (player) {
			player.remove();
		});
		// Reset deck
		gameState = setupInitializeGameState();
		setupInit();
	}
	function setupShuffleDeck() {
		for (let i = gameState.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
		}
	}
	// -------------------------------------------------------------
	// REPORTING AND VISUALIZATION FUNCTIONS
	// -------------------------------------------------------------
	function reportShowAllHands(gameState) {
		let output = 'Hands of all players:\n';
		for (let i = 0; i < gameState.players.length; i++) {
			output += `Player ${i + 1} (${gameState.players[i].type}): ${gameState.players[i].hand[0].name}${gameState.players[i].hand[0].suit} ${gameState.players[i].hand[1].name}${gameState.players[i].hand[1].suit}\n`;
		}
		return output;
	}
	function reportShowPlayerTypes(gameState) {
		let output = 'Player types:\n';
		for (let i = 0; i < gameState.players.length; i++) {
			output += `Player ${i + 1}: ${gameState.players[i].type}\n`;
		}
		return output;
	}
	function reportShowPotOdds(gameState, myPosition) {
		let potOdds = preFlopPotOdds(gameState, myPosition);
		let output = `Pot Odds: ${potOdds.toFixed(2)} (${(potOdds * 100).toFixed(2)}%)\n`;
		return output;
	}
	function reportShowExpectedValue(gameState, myPosition) {
		let ev = preFlopExpectedValue(gameState, myPosition);
		let output = `Expected Value: $${ev.toFixed(2)}\n`;
		return output;
	}
	function reportShowPositionStats(gameState) {
		let output = 'Position stats:\n';
		for (const position in gameState.positionCounts) {
			let totalHands = gameState.totalHands;
			let positionCount = gameState.positionCounts[position];
			let percentage = positionCount / totalHands * 100;
			output += `${position}: ${positionCount} hands (${percentage.toFixed(2)}%)\n`;
		}
		return output;
	}
	// -------------------------------------------------------------
	// PRIVATE UTILITY FUNCTIONS
	// -------------------------------------------------------------
	// John Resig - http://ejohn.org/blog/javascript-micro-templating/ - MIT Licensed
	function _tmpl(str, data) { let tmplCache = []; let fn = !/\W/.test(str) ? tmplCache[str] = tmplCache[str] || _tmpl(document.getElementById(str).innerHTML) : new Function("obj", "let p=[],print=function(){p.push.apply(p,arguments);};" + "with(obj){p.push('" + str.replace(/[\r\t\n]/g, " ").split("<%").join("\t").replace(/((^|%>)[^\t]*)'/g, "$1\r").replace(/\t=(.*?)%>/g, "',$1,'").split("\t").join("');").split("%>").join("p.push('").split("\r").join("\\'") + "');}return p.join('');"); return data ? fn( data ) : fn; }
	// -------------------------------------------------------------
	// PUBLIC FACING METHODS
	// -------------------------------------------------------------
	return {
		init: function () {
			if (document.readyState === 'complete') {
				setupInit();
			} else {
				window.addEventListener('load', setupInit, false);
			}
		}
	};
} ();

PB.Core.init();