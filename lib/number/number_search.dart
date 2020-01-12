import 'dart:math';

import 'package:dingn/number/number.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:flutter/material.dart';

class NumberSearch extends SearchDelegate<Number> {
  NumberSearch(this.numberModel);
  final NumberModel numberModel;

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
    return FutureBuilder(future: numberModel.find(query),
      builder: (BuildContext context, AsyncSnapshot<Number> snapshot){
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
                numberModel: numberModel,
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
  const _ResultCard({this.numberModel, this.item, this.searchDelegate});

  final Number item;
  final SearchDelegate<Number> searchDelegate;
  final NumberModel numberModel;
  @override
  _ResultCardState createState() => _ResultCardState(item);
}

class _ResultCardState extends State<_ResultCard>{
  _ResultCardState(this.item);
  Number item;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        widget.searchDelegate.close(context, item);
      },
      child: NumberCard(
        number: item, 
        onFavorite: (word) async {
          setState(() {
            item = item.setMyFavoriteWord(word);
          });
          await widget.numberModel.saveFavoriteWord(item.number, word);
        },
        alwaysShowTwoSides: false,
      ),
    );
  }
}