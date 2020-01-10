import 'package:dingn/account/account.dart';
import 'package:dingn/account/account_model.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/word/word.dart';
import 'package:flip_card/flip_card.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WordCard extends StatelessWidget {
  const WordCard({Key key, this.word}) : super(key: key);
  final Word word;

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    if (accountModel.cardSide == CardSide.TwoSides){
      return FlipCard(
        front: Container(
          child: Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15.0)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.bookmark, size: 50, color: AppTheme.accentColor,),
                  title: Text(word.word, style: const TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold, fontSize: AppTheme.fontSizeBrand)),
                  subtitle: Text('${word.lang}: ${word.ipa}')
                ),
              ],
            ),
          ),
        ),
        back: _getFullCard(word),
      );
    }
    return _getFullCard(word);
  }
}

Widget _getFullCard(Word word){
  return Container(
          //constraints: const BoxConstraints(minWidth: 120, minHeight: 80, maxWidth: 600, maxHeight: 400),
          child: Card(
            //margin: const EdgeInsets.all(20),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15.0)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.bookmark, size: 50, color: AppTheme.accentColor,),
                  title: Text(word.word, style: const TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold)),
                  subtitle: Text('${word.lang}: ${word.ipa}')
                ),
                const Divider(height: 10, thickness:1, indent: 20, endIndent: 20,),
                Padding(
                  padding: const EdgeInsets.all(20),  
                  child: Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: <Widget>[
                    const Text('Number (major system):', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 20),
                    Text(word.number, style: const TextStyle(color: AppTheme.accentColor)),
                  ],
                ),
                ),
                const Divider(height: 10, thickness:1, indent: 20, endIndent: 20,),
                Expanded(
                  child:
                  Container(
                    padding: const EdgeInsets.all(10),  
                  
                    //height: 300,
                    child: ListView(
                      //controller: _controller,
                      //mainAxisSize: MainAxisSize.min,
                      //crossAxisAlignment: CrossAxisAlignment.start,
                      //shrinkWrap: true,
                      children: word.pos.entries
                          .map((i) => _buildMapEntry(i))
                          .expand((j) => j)
                          .toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
}

Iterable<Widget> _buildMapEntry(MapEntry<String, dynamic> mapEntry) sync* {
  yield Padding(
    padding: const EdgeInsets.only(left:10),
    child: Text('${mapEntry.key}\n', style: const TextStyle(fontWeight: FontWeight.bold))
  );
  for (var index=0; index<mapEntry.value.length; ++index) {
    yield Padding(
      padding: const EdgeInsets.only(left:20),
      child: Text('${index+1}. ${mapEntry.value[index]}\n')
    );
  }
}
