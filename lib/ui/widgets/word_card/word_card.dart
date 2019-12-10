import 'package:dingn/models/word_model.dart';
import 'package:dingn/utils/url_util.dart';
import 'package:flutter/material.dart';

class WordCard extends StatelessWidget {
  const WordCard({Key key, this.item}) : super(key: key);
  final Word item;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        UrlUtil.open('https://en.wiktionary.org/wiki/${item.word}');
      },
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Card(
          child: Container(
            child: Column(
              children: <Widget>[
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                    item.word,
                    overflow: TextOverflow.ellipsis,
                  ),
                  ),
                ),
                Expanded(
                  child: 
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                      '[${item.ipaEn}]: ${item.number}',
                      overflow: TextOverflow.ellipsis,
                      //style: Theme.of(context).textTheme.headline,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
