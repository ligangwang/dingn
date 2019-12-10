class Validators {
  final RegExp _emailRegExp = RegExp(
    r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$',
  );
  // final RegExp _passwordRegExp = RegExp(
  //   r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$',
  // );

  bool isValidEmail(String email) {
    return _emailRegExp.hasMatch(email);
  }

  bool isValidPassword(String password) {
    // return _passwordRegExp.hasMatch(password);
    return password.length >= 6;
  }
}