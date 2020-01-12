const playingCardSuits = ['C', 'D', 'H', 'S'];
final playingNumCards = List.generate(9, (i)=>(i+2).toString());
const playingFaceCards = ['J', 'Q', 'K', 'A'];
final playingCardsPerSuit = playingNumCards + playingFaceCards;
final playingCards = playingCardSuits.map((i)=> playingCardsPerSuit.map((j)=>i+j)).expand((k)=>k).toList();
const suitToNumber = {
  //club
  'C': '7',
  //diamond
  'D': '1',
  //heard
  'H': '4',
  //spade
  'S': '0' 
};

const faceToNumber = {
  'J': '67',
  'Q': '72',
  'K': '77',
  'A': '0'
};

final playingCardSuiteNumbers = playingCardSuits.map((i)=>suitToNumber[i]).toList();
final playingCardsPerSuitNumbers = playingNumCards + playingFaceCards.map((i)=>faceToNumber[i]).toList();
final playingCardNumbers = playingCardSuiteNumbers.map((i)=> playingCardsPerSuitNumbers.map((j)=>i+j)).expand((k)=>k).toList();
final playingCardToNumber = Map<String, String>.fromIterables(playingCards, playingCardNumbers);
final playingNumberToCard = Map<String, String>.fromIterables(playingCardNumbers, playingCards);