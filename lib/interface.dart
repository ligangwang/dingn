import 'package:dingn/account/account.dart';

abstract class DBService {
  Future<bool> setDoc(
      String collection, String? docId, Map<String, dynamic> doc);
  Future<Map<String, dynamic>?> getDoc(String? collection, String? docId);
  Future<bool> exists(String collection, String field, String value);
  Future<List<Map<String, dynamic>>> query(String collection, String field,
      dynamic value, String orderBy, int batchSize);
  Future<List<Map<String, dynamic>>> queryBatch(
      String? collection, int? batchSize);
}

abstract class AuthService {
  Stream<Account?>? get accountChanges;
  Future<Account?> signInWithGoogle();
  Future<Account?> signInWithCredentials(String? email, String? password);
  Future<Account?> signUp(String? email, String? password);
  Future<dynamic> signOut();
  Future<void> sendPasswordResetEmail(String email);
}

abstract class PaymentService {
  Future<void> createSubscription(String userId, String planId);
  Future<void> updateSubscription(String subscriptionId, String newPlanId);
  Future<void> cancelSubscription(String subscriptionId);
  Future<void> handlePaymentCallback(Map<String, dynamic> paymentData);
  Future<void> handleWebhook(Map<String, dynamic> webhookData);
}
