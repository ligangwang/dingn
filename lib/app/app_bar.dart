import 'package:dingn/account/account_model.dart';
import 'package:dingn/number/number.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/number/number_search.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/word/word.dart';
import 'package:dingn/word/word_model.dart';
import 'package:dingn/word/word_search.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

class MyAppBar extends StatelessWidget implements PreferredSizeWidget {
  const MyAppBar(this.name);
  final String? name;
  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.of(context).size.width < 600;
    return AppBar(
      toolbarHeight: 76,
      automaticallyImplyLeading: false,
      titleSpacing: compact ? 12 : 28,
      title: TextButton(
        onPressed: () => Navigator.of(context)
            .pushNamedAndRemoveUntil('/', (route) => false),
        child: const Text('dingn',
            style: TextStyle(
                color: accentColor,
                fontWeight: FontWeight.bold,
                fontSize: 28,
                letterSpacing: -1.5)),
      ),
      shape: const Border(bottom: BorderSide(color: borderColor)),
      actions: [
        _nav(context, '/word', 'Words', Icons.text_fields_rounded, compact),
        _nav(context, '/number', 'Numbers', Icons.tag_rounded, compact),
        _nav(context, '/card', 'Cards', Icons.style_outlined, compact),
        if (name == '/number') NumberSearchButton(),
        if (name == '/word') WordSearchButton(),
        const SizedBox(width: 8),
        AccountButton(),
        SizedBox(width: compact ? 8 : 28),
      ],
    );
  }

  Widget _nav(BuildContext context, String route, String label, IconData icon,
      bool compact) {
    void open() =>
        Navigator.of(context).pushNamedAndRemoveUntil(route, (route) => false);
    if (compact)
      return IconButton(
          tooltip: label,
          onPressed: open,
          icon: Icon(icon, color: name == route ? accentColor : mutedColor),
          style: IconButton.styleFrom(
              backgroundColor:
                  name == route ? alternateColor : Colors.transparent));
    return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: TextButton(
          onPressed: open,
          style: TextButton.styleFrom(
              foregroundColor: name == route ? accentColor : mutedColor,
              backgroundColor:
                  name == route ? alternateColor : Colors.transparent,
              padding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 18)),
          child: Text(label,
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ));
  }

  @override
  Size get preferredSize => const Size.fromHeight(76);
}

class NumberSearchButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: 'Search numbers',
        icon: const Icon(Icons.search),
        onPressed: () async => showSearch<Number?>(
            context: context,
            delegate: NumberSearch(
                provider.Provider.of<NumberModel>(context, listen: false))),
      );
}

class WordSearchButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: 'Search words',
        icon: const Icon(Icons.search),
        onPressed: () async => showSearch<Word?>(
            context: context,
            delegate: WordSearch(
                provider.Provider.of<WordModel>(context, listen: false))),
      );
}

class AccountButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    if (accountModel.isSignedIn) {
      return IconButton(
        tooltip: 'Your account',
        onPressed: () => Navigator.of(context)
            .pushNamedAndRemoveUntil('/account', (route) => false),
        icon: CircleAvatar(
          radius: 17,
          backgroundColor: accentColor,
          foregroundColor: Colors.white,
          backgroundImage: accountModel.account!.photoURL != null
              ? NetworkImage(accountModel.account!.photoURL!)
              : null,
          child: Text(
              accountModel.account!.photoURL != null
                  ? ''
                  : accountModel.account!.initials,
              style: const TextStyle(fontSize: 12)),
        ),
      );
    }
    return Center(
        child: FilledButton(
      onPressed: () => Navigator.of(context).pushNamed('/signin'),
      style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16)),
      child: const Text('Sign in', style: TextStyle(fontSize: 12)),
    ));
  }
}
