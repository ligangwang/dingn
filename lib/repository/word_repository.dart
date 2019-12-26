import 'package:dingn/models/word_model.dart';
import 'package:dingn/repository/interface.dart';

class WordRepository {
  WordRepository(DBService db): _db = db;

  final DBService _db;

  Future<List<Word>> retrieveData() async {
    try {
      final data = await _db.queryBatch('words', 20);
      return data.map((d)=>_docToWord(d)).toList();
    } catch (e) {
      throw '$e';
    }
  }

  Word _docToWord(Map<String, dynamic> data){
    return Word(data['word'], data['ipa'], data['number'], data['favorites'] ?? 0);
  }

  Future<Word> getWord(String word, String number) async {
    final data = await _db.getDoc('words', word);
    return _docToWord(data);
  }

  Future<bool> setWord(Word word) async {
    await _db.setDoc('words', word.word, {'number': word.number, 'favorite_count': word.favoriteCount, 'ipa_en': word.ipaEn});
    return true;
  }
}
