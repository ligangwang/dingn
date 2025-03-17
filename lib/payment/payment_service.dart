import 'dart:convert';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

class PaymentService {
  PaymentService() {
    _initializeStripe();
  }

  Future<void> _initializeStripe() async {
    Stripe.publishableKey = 'your-publishable-key';
    await Stripe.instance.applySettings();
  }

  Future<Map<String, dynamic>> createPaymentIntent(
      String amount, String currency) async {
    try {
      // Call your backend to create a PaymentIntent
      final response = await http.post(
        Uri.parse('https://your-backend.com/create-payment-intent'),
        body: {
          'amount': amount,
          'currency': currency,
        },
      );
      return jsonDecode(response.body);
    } catch (err) {
      throw Exception('Failed to create PaymentIntent: $err');
    }
  }

  Future<void> handlePayment(String amount, String currency) async {
    try {
      final paymentIntent = await createPaymentIntent(amount, currency);
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: paymentIntent['client_secret'],
          merchantDisplayName: 'Your Merchant Name',
        ),
      );
      await Stripe.instance.presentPaymentSheet();
    } catch (e) {
      throw Exception('Failed to handle payment: $e');
    }
  }
}
