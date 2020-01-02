import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/widgets/load_more_widget.dart';
import 'package:dingn/word/word_card.dart';
import 'package:dingn/word/word_model.dart';
import 'package:flutter/material.dart';

class WordScreen extends StatelessWidget{
  @override
  Widget build(BuildContext context) {
    return ProviderScreen<WordModel>(
      modelBuilder: ()=>WordModel(1),
      builder: (context, WordModel wordModel, _){
        return Container(
          //constraints: const BoxConstraints(maxWidth: 600),
          padding: const EdgeInsets.all(10),
          child:
            PageView.builder(
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index){
                if (index>=wordModel.itemCount){
                  wordModel.loadData();
                  return LoadMoreWidget();
                }else{
                  return WordCard(
                    word: wordModel.items[index],
                  );
                }
              },
              itemCount: wordModel.hasMoreData? wordModel.itemCount + 1: wordModel.itemCount,
              physics: const ClampingScrollPhysics(),
            ),
          );
      }
    );
  }
}
