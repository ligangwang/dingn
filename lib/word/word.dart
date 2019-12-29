class Word{
  Word(this.word, {this.ipa, this.lang, this.pos, this.number, this.favorites});
  final String word;
  final String ipa;
  final String lang;
  final Map<String, dynamic> pos;
  final String number;
  final int favorites;
}