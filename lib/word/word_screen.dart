import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/widgets/load_more_widget.dart';
import 'package:dingn/word/word_model.dart';
import 'package:flutter/material.dart';

class WordScreen extends StatelessWidget{
  @override
  Widget build(BuildContext context) {
    return ProviderScreen<WordModel>(
      modelBuilder: ()=>WordModel(1),
      builder: (context, WordModel wordModel, _){
        return Padding(
          padding: const EdgeInsets.all(10),
          child:
          PageView.builder(
            scrollDirection: Axis.horizontal,
            itemBuilder: (context, index){
              if (index>=wordModel.wordCount){
                wordModel.loadData();
                return LoadMoreWidget();
              }else{
                return Card(
                  elevation: 2,
                  child: Text(wordModel.items[index].word),
                );
              }
            },
            itemCount: wordModel.hasMoreData? wordModel.wordCount + 1: wordModel.wordCount,
            physics: const ClampingScrollPhysics(),
          ),
        );
      }
    );
  }
}


class HeaderWidget extends StatelessWidget {
  const HeaderWidget(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Text(text, style: Theme.of(context).textTheme.display1),
    );
  }
}

