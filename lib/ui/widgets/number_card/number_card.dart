import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/models/number_model.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NumberCard extends StatelessWidget {
  const NumberCard({Key key, this.numbers, this.itemIndex}) : super(key: key);
  final List<Number> numbers;
  final int itemIndex;
  Number get item => numbers[itemIndex];

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
          BlocProvider.of<PageBloc>(context).add(NavigateToPageEvent(PageState(pageName:PageName.NumberDetail, items:numbers, itemIndex:itemIndex)));
      },
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Card(
          child: Container(
            child: Column(
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.all(8),  
                  child:Text(
                    '${numbers[itemIndex].number}',
                    textAlign: TextAlign.left,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold),
                  )
                ),
                Expanded(
                  child: Wrap(
                    spacing: 8.0,
                    children: <Widget>[
                      if (item.favoriteWord!=null)
                        Text(item.favoriteWord)
                      else
                        for(final word in item.words.take(10))
                          Text(word)
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      )
    );
  }
}
