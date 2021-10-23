import 'dart:math';

import 'package:dingn/widgets/loading.dart';
import 'package:dingn/word/word.dart';
import 'package:dingn/word/word_card.dart';
import 'package:dingn/word/word_model.dart';
import 'package:flutter/material.dart';

class WordSearch extends SearchDelegate<Word?> {
  WordSearch(this.wordModel);
  final WordModel wordModel;

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      icon: AnimatedIcon(
        icon: AnimatedIcons.menu_arrow,
        progress: transitionAnimation,
      ),
      onPressed: () {
        close(context, null);
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return Container();
  }

  @override
  Widget buildResults(BuildContext context) {
    return FutureBuilder(future: wordModel.find(query),
      builder: (BuildContext context, AsyncSnapshot<Word> snapshot){
        final size = MediaQuery.of(context).size;
        if (snapshot.connectionState==ConnectionState.waiting){
          return Loading();
        }
        if (snapshot.data==null) {
          return Center(
            child: Text(
              '"$query"\n does not exist.\n',
              textAlign: TextAlign.center,
            ),
          );
        }

        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              height: min(size.height, 600),
              width: min(size.width, 800),
              child: _ResultCard(
                item: snapshot.data,
                searchDelegate: this,
              )
            )
          ]
        );
      }
    );
  }

  @override
  List<Widget> buildActions(BuildContext context) {
    return <Widget>[
        IconButton(
          tooltip: 'Clear',
          icon: const Icon(Icons.clear),
          onPressed: () {
            query = '';
            showSuggestions(context);
          },
        ),
    ];
  }
}

class _ResultCard extends StatefulWidget {
  const _ResultCard({this.item, this.searchDelegate});

  final Word? item;
  final SearchDelegate<Word?>? searchDelegate;
  @override
  _ResultCardState createState() => _ResultCardState(item);
}

class _ResultCardState extends State<_ResultCard>{
  _ResultCardState(this.item);
  Word? item;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        widget.searchDelegate!.close(context, item);
      },
      child: WordCard(
        word: item
      ),
    );
  }
}