import 'package:dingn/repository/interface.dart';
import 'package:firebase/firebase.dart';
import 'package:firebase/firestore.dart';


class FirebaseDBService implements DBService{
  FirebaseDBService(App app)
      : _db = firestore(app){
        _lastDocs = {};
      }

  final Firestore _db;
  Map<dynamic, DocumentSnapshot> _lastDocs;

  @override
  Future<bool> setDoc(String collection, String docId, Map<String, dynamic> doc) async{
    final docRef = _db.collection(collection).doc(docId);
    await docRef.set(doc);
    return true;
  }

  @override
  Future<Map<String, dynamic>> getDoc(String collection, String docId) async{
    final docRef = _db.collection(collection).doc(docId);
    final docSnapshot = await docRef.get();
    return docSnapshot.data();
  }

  @override
  Future<bool> exists(String collection, String field, String value) async{
      final querySnapshot = await _db.collection(collection)
          .where(field, '==', value)
          .get();
      return querySnapshot.docs.isNotEmpty;
  }

  @override
  Future<List<Map<String, dynamic>>> query(String collection, String field, dynamic value, int batchSize) async {
    try {
      QuerySnapshot querySnapshot;
      if (_lastDocs[value] != null){
        querySnapshot = await _db.collection(collection)
          .where(field, '==', value)
          .startAfter(snapshot:_lastDocs[value])
          .limit(batchSize).get();
      }
      else{
        querySnapshot = await _db.collection(collection)
          .where(field, '==', value)
        .limit(batchSize).get();
      }
      if (querySnapshot.docs.isNotEmpty){
        _lastDocs[value] = querySnapshot.docs[querySnapshot.docs.length-1];
        return querySnapshot.docs.map((doc)=>doc.data()).toList();
      }else{
        return <Map<String, dynamic>>[];
      }
    } catch (e) {
      print('Error in retrieving data: $e');
      rethrow;
    }
  }

  @override
  Future<List<Map<String, dynamic>>> queryBatch(String collection, int batchSize) async {
    try {
        final querySnapshot = await _db.collection(collection).limit(batchSize).get();
        return querySnapshot.docs.map((doc)=>doc.data()).toList();
    } catch (e) {
      print('Error in retrieving data: $e');
      return <Map<String, dynamic>>[];
    }
  }  
}