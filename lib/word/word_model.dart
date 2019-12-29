import 'package:dingn/account/provider_model.dart';
import 'package:dingn/word/word.dart';

class WordModel extends ListProviderModel<Word>{
  WordModel(int requestBatchSize):super('words', requestBatchSize);
  
  @override
  Word dictToItem(Map<String, dynamic> data){
    return Word(
        data['word'], 
        ipa: data['ipa'], 
        lang: data['ipa-lang'],
        number: data['number'], 
        pos: data['pos'],
        favorites: data['favorites'] ?? 0
    );
  }
  
  @override
  Future<List<Map<String, dynamic>>> loadDataFromDb() async {
    return await db.queryBatch(collectionName, requestBatchSize);
  }
}