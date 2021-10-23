import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dingn/interface.dart';
import 'package:firebase_core/firebase_core.dart';

class FirebaseDBService implements DBService {
  FirebaseDBService(FirebaseApp app)
      : _db = FirebaseFirestore.instanceFor(app: app) {
    _lastDocs = {};
  }

  final FirebaseFirestore _db;
  late Map<String, DocumentSnapshot> _lastDocs;

  @override
  Future<bool> setDoc(
      String collection, String? docId, Map<String, dynamic> doc) async {
    final docRef = _db.collection(collection).doc(docId);
    await docRef.set(doc);
    return true;
  }

  @override
  Future<Map<String, dynamic>?> getDoc(
      String? collection, String? docId) async {
    final docRef = _db.collection(collection!).doc(docId);
    final docSnapshot = await docRef.get();
    return docSnapshot.data();
  }

  @override
  Future<bool> exists(String collection, String field, String value) async {
    final querySnapshot =
        await _db.collection(collection).where(field, isEqualTo: value).get();
    return querySnapshot.docs.isNotEmpty;
  }

  @override
  Future<List<Map<String, dynamic>>> query(String collection, String field,
      dynamic value, String orderBy, int batchSize) async {
    try {
      QuerySnapshot querySnapshot;
      final lastDockey = '$collection-$field-$value';
      if (_lastDocs.containsKey(lastDockey)) {
        querySnapshot = await _db
            .collection(collection)
            .where(field, isEqualTo: value)
            .orderBy(orderBy)
            .startAfterDocument(_lastDocs[lastDockey]!)
            .limit(batchSize)
            .get();
      } else {
        querySnapshot = await _db
            .collection(collection)
            .where(field, isEqualTo: value)
            .orderBy(orderBy)
            .limit(batchSize)
            .get();
      }
      if (querySnapshot.docs.isNotEmpty) {
        _lastDocs[lastDockey] =
            querySnapshot.docs[querySnapshot.docs.length - 1];
        final result = querySnapshot.docs
            .map((doc) => doc.data() as Map<String, dynamic>)
            .toList();
        return result;
      } else {
        return <Map<String, dynamic>>[];
      }
    } catch (e) {
      print('Error in query data: $e');
      rethrow;
    }
  }

  static final int _randMax = pow(2, 32) as int;
  static final int _negInt64 = pow(2, 63) as int;
  static final int _compInt64 = 2 * _negInt64;
  int _getRandom() {
    final r =
        (Random().nextInt(_randMax) * _randMax) + Random().nextInt(_randMax);
    return r >= _negInt64 ? r - _compInt64 : r;
  }

  @override
  Future<List<Map<String, dynamic>>> queryBatch(
      String? collection, int? batchSize) async {
    try {
      final querySnapshot = await _db
          .collection(collection!)
          .where('random', isGreaterThanOrEqualTo: _getRandom())
          .limit(batchSize!)
          .get();
      if (querySnapshot.docs.isNotEmpty) {
        return querySnapshot.docs.map((doc) {
          final d = doc.data();
          if (d['word'] == null) {
            d['word'] = doc.id;
          }
          return d;
        }).toList();
      } else {
        return <Map<String, dynamic>>[];
      }
    } catch (e) {
      print('Error in queryBatch data: $e');
      return <Map<String, dynamic>>[];
    }
  }
}
