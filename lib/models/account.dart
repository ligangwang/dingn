class Account{
  Account({this.userName, this.photoURL, this.fullName, this.occupation, this.bio, this.followers, this.following, this.level,
  this.uid, this.email});

  final String userName;
  final String fullName;
  final String photoURL;
  final String occupation;
  final String bio;
  final int followers;
  final int following;
  final int level;
  final String uid;
  final String email;
  String get initials => (userName ?? email).substring(1, 3).toUpperCase();

}