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
    return AppBar(
      title: InkWell(
        onTap: () {
          Navigator.of(context)
              .pushNamedAndRemoveUntil('/', (Route<dynamic> route) => false);
        },
        child: const Text(
          'dingn',
          style: TextStyle(
              color: AppTheme.accentColor,
              fontWeight: FontWeight.bold,
              fontSize: AppTheme.fontSizeBrand),
        ),
      ),
      backgroundColor: Colors.white,
      elevation: 1,
      actions: <Widget>[
        if (name != '/word')
          InkWell(
              onTap: () {
                Navigator.of(context).pushNamedAndRemoveUntil(
                    '/word', (Route<dynamic> route) => false);
              },
              child: Container(
                  width: 50,
                  child: Column(children: const <Widget>[
                    Icon(
                      Icons.library_books,
                      color: AppTheme.accentColor,
                    ),
                    Text('word',
                        style: TextStyle(
                            color: AppTheme.accentColor,
                            fontSize: AppTheme.fontSizeIconButtonText)),
                  ]))),
        if (name != '/number')
          InkWell(
              onTap: () {
                Navigator.of(context).pushNamedAndRemoveUntil(
                    '/number', (Route<dynamic> route) => false);
              },
              child: Container(
                  width: 50,
                  child: Column(children: const <Widget>[
                    Icon(Icons.subject, color: AppTheme.accentColor),
                    Text('number',
                        style: TextStyle(
                            color: AppTheme.accentColor,
                            fontSize: AppTheme.fontSizeIconButtonText)),
                  ]))),
        if (name != '/card')
          InkWell(
              onTap: () {
                Navigator.of(context).pushNamedAndRemoveUntil(
                    '/card', (Route<dynamic> route) => false);
              },
              child: Container(
                  width: 50,
                  child: Column(children: const <Widget>[
                    Icon(Icons.sd_card, color: AppTheme.accentColor),
                    Text('card',
                        style: TextStyle(
                            color: AppTheme.accentColor,
                            fontSize: AppTheme.fontSizeIconButtonText)),
                  ]))),
        if (name == '/number') NumberSearchButton(),
        if (name == '/word') WordSearchButton(),
        AccountButton(),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(56.0);
}

class NumberSearchButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final numberModel =
        provider.Provider.of<NumberModel>(context, listen: false);
    return IconButton(
      icon: const Icon(Icons.search),
      onPressed: () async {
        await showSearch<Number?>(
            context: context, delegate: NumberSearch(numberModel));
      },
    );
  }
}

class WordSearchButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.search),
      onPressed: () async {
        await showSearch<Word?>(
            context: context,
            delegate: WordSearch(provider.Provider.of<WordModel>(context)));
      },
    );
  }
}

class AccountButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    if (accountModel.isSignedIn)
      return TextButton(
        onPressed: () {
          Navigator.of(context).pushNamedAndRemoveUntil(
              '/account', (Route<dynamic> route) => false);
        },
        style: TextButton.styleFrom(
            shape: const CircleBorder(side: BorderSide.none)),
        child: CircleAvatar(
          backgroundColor: AppTheme.accentColor,
          foregroundColor: Colors.white,
          backgroundImage: accountModel.account!.photoURL != null
              ? NetworkImage(accountModel.account!.photoURL!)
              : null,
          child: Text(accountModel.account!.photoURL != null
              ? ''
              : accountModel.account!.initials),
        ),
      );
    else
      return InkWell(
          onTap: () {
            Navigator.of(context).pushNamed('/signin');
          },
          child: Container(
              width: 50,
              child: Column(children: const <Widget>[
                Icon(
                  Icons.account_box,
                  color: AppTheme.accentColor,
                ),
                Text('signin',
                    style: TextStyle(
                        color: AppTheme.accentColor,
                        fontSize: AppTheme.fontSizeIconButtonText)),
              ])));
  }
}
