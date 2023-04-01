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
	let gameState = setupInitializeGameState();
	// -------------------------------------------------------------
	// PRIVATE ANALYSIS (CARD AND HAND) FUNCTIONS
	// -------------------------------------------------------------
	function analysisCreateDeck() {
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
	function analysisCreatePlayers(numPlayers) {
		if (numPlayers < 2 || numPlayers > 10) {
			alert('Invalid number of players');
			return false;
		}
		const players = [];
		for (let i = 0; i < numPlayers; i++) {
			players.push({
				id: i,
				type: setupGetPlayerType(),
				stackSize: Math.floor(Math.random() * (250 - 50 + 1) + 50),
				hand: []
			});
		}
		return players;
	}
	function analysisEvaluateHand(hand) {
		// Evaluate the hand
		const handValue = PokerEvaluator.evalHand(hand);
		return handValue;
	}
	function analysisGenerateCard(deck) {
		return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
	}
	function analysisGetHandStrength(hand) {
		const handValue = analysisEvaluateHand(hand);
		const handStrength = handValue.strength; // Or another relevant property depending on the library
		return handStrength;
	}
	function analysisHandStrengthVisualization(hand) {
		// Code for visualizing hand strength using a library or custom implementation
	}
	// -------------------------------------------------------------
	// PRIVATE ODDS AND EXPECTED VALUE FUNCTIONS
	// -------------------------------------------------------------
	function oddsCalculateExpectedValue(handStrength, potOdds, betAmount) {
		let winAmount = handStrength * (potOdds * betAmount);
		let loseAmount = (1 - handStrength) * betAmount;
		return winAmount - loseAmount;
	}
	function oddsCalculatePotOdds(potSize, betAmount) {
		return betAmount / (potSize + betAmount);
	}
	// -------------------------------------------------------------
	// PRIVATE PRE-FLOP DECISION MAKING FUNCTIONS
	// -------------------------------------------------------------
	function preFlopDecision(gameState, myPosition) {
		let optimalRanges = preFlopGetOptimalHandRanges();
		let playerHandRange = preFlopGetPlayerHandRange(gameState.players[myPosition]);
		let actionsBeforeMe = preFlopPlayerActionsBeforeMe(gameState, myPosition);
		let effectiveStackSize = preFlopEffectiveStackSize(gameState, myPosition);
		let potOdds = preFlopPotOdds(gameState, myPosition);
		let expectedValue = preFlopExpectedValue(gameState, myPosition);

		let positionType = setupGetMyPositionType(myPosition, gameState.players.length);
		let optimalRange = optimalRanges[positionType];

		if (expectedValue > 0 && (playerHandRange.raise.includes(gameState.players[myPosition].cards) || playerHandRange.reraise.includes(gameState.players[myPosition].cards))) {
			if (actionsBeforeMe.some(action => action === 'raise') && playerHandRange.reraise.includes(gameState.players[myPosition].cards)) {
				return 'reraise';
			} else {
				return 'raise';
			}
		} else if (expectedValue > 0 && playerHandRange.call.includes(gameState.players[myPosition].cards)) {
			return 'call';
		} else {
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
	function setupDealCards(gameState) {
		for (const player of gameState.players) {
			player.hand = [analysisGenerateCard(gameState.deck), analysisGenerateCard(gameState.deck)];
		}
	}
	function setupGetPosition(gameState) {
		return gameState.dealerPosition;
		// return (gameState.players.length + 1) % gameState.players.length;
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
		gameState.players = analysisCreatePlayers(prompt("Enter the number of players (2-10): "));
		// If player count is off, don't continue
		if (!gameState.players) {
			return;
		}
		gameState.deck = analysisCreateDeck();
		setupShuffleDeck(gameState.deck);
		setupDealCards(gameState);
		gameState.position = setupGetPosition(gameState);
	}
	function setupInitializeGameState() {
		return {
			players: [],
			deck: [],
			positionCounts: {
				early: 0,
				cutoff: 0,
				button: 0,
				blinds: 0
			}
		};
	}
	function setupResetGameState() {
		return gameState = setupInitializeGameState();
	}
	function setupShuffleDeck(deck) {
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
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