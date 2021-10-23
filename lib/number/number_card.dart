import 'package:dingn/account/account.dart';
import 'package:dingn/account/account_model.dart';
import 'package:dingn/number/number.dart';
import 'package:dingn/themes.dart';
import 'package:flip_card/flip_card.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

class NumberCard extends StatelessWidget {
  const NumberCard(
      {Key? key,
      this.number,
      this.onFavorite,
      required this.alwaysShowTwoSides,
      this.front})
      : super(key: key);
  final Number? number;
  final Future<void> Function(String)? onFavorite;
  final bool alwaysShowTwoSides;
  final Widget? front;

  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    if (accountModel.cardSide == CardSide.TwoSides || alwaysShowTwoSides) {
      return FlipCard(
          front: Container(
            child: _getFrontCard(),
          ),
          back: _getFullCard(number!, onFavorite));
    }
    return _getFullCard(number!, onFavorite);
  }

  Widget? _getFrontCard() {
    if (front != null)
      return front;
    else
      return Card(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            ListTile(
              leading: const Icon(
                Icons.bookmark,
                size: 50,
                color: AppTheme.accentColor,
              ),
              title: Text(number!.number,
                  style: const TextStyle(
                      color: AppTheme.accentColor,
                      fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
  }
}

Widget _getFullCard(Number number, Future<void> Function(String)? onFavorite) {
  return Container(
    child: Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          ListTile(
            leading: const Icon(
              Icons.bookmark,
              size: 50,
              color: AppTheme.accentColor,
            ),
            title: Text(number.number,
                style: const TextStyle(
                    color: AppTheme.accentColor, fontWeight: FontWeight.bold)),
          ),
          const Divider(
            height: 10,
            thickness: 1,
            indent: 20,
            endIndent: 20,
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                const Text('Favorite word:',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(width: 20),
                if (number.favoriteWord != null)
                  Text(number.favoriteWord!,
                      style: const TextStyle(color: AppTheme.accentColor)),
              ],
            ),
          ),
          const Divider(
            height: 10,
            thickness: 1,
            indent: 20,
            endIndent: 20,
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(10),
              child: ListView(children: <Widget>[
                for (var item in number.words)
                  WordItem(item, item == number.favoriteWord, onFavorite)
              ]),
            ),
          ),
        ],
      ),
    ),
  );
}

class WordItem extends StatelessWidget {
  const WordItem(this.word, this.isFavorite, this.onFavorite);
  final String word;
  final bool isFavorite;
  final Future<void> Function(String)? onFavorite;
  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(word),
      leading: IconButton(
        icon: const Icon(Icons.favorite),
        color: isFavorite ? Colors.redAccent : Colors.grey,
        onPressed: () {
          if (!isFavorite) {
            onFavorite!(word);
          }
        },
      ),
      trailing: null,
      //subtitle: Hyperlink(text:'https://en.wiktionary.org/wiki/${sortedWords[index]}', url:'https://en.wiktionary.org/wiki/${sortedWords[index]}')
    );
  }
}
