import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:dingn/word/word_card.dart';
import 'package:dingn/word/word_model.dart';
import 'package:flutter/material.dart';

class WordScreen extends StatefulWidget {
  @override
  _WordScreenState createState() => _WordScreenState();
}

class _WordScreenState extends State<WordScreen> {
  final PageController _pageController =
      PageController(initialPage: 0, keepPage: true);
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void prev() {
    _pageController.previousPage(
        duration: const Duration(microseconds: 400), curve: Curves.easeInOut);
  }

  void next() {
    _pageController.nextPage(
        duration: const Duration(microseconds: 400), curve: Curves.easeInOut);
  }

  @override
  Widget build(BuildContext context) {
    return ProviderScreen<WordModel>(
        name: '/word',
        modelBuilder: () => WordModel(1),
        builder: (context, WordModel wordModel, _) {
          return Container(
            //constraints: const BoxConstraints(maxWidth: 600),
            padding: const EdgeInsets.all(10),
            child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: <Widget>[
                  IconButton(
                      icon: const Icon(Icons.navigate_before),
                      tooltip: 'previous',
                      onPressed: () {
                        prev();
                      },
                      color: Colors.redAccent),
                  IconButton(
                      icon: const Icon(Icons.navigate_next),
                      tooltip: 'next',
                      onPressed: () {
                        next();
                      },
                      color: Colors.redAccent),
                ],
              ),
              Expanded(
                  child: PageView.builder(
                scrollDirection: Axis.horizontal,
                controller: _pageController,
                itemBuilder: (context, index) {
                  if (index >= wordModel.itemCount) {
                    wordModel.loadData();
                    return Loading();
                  } else {
                    return WordCard(
                      word: wordModel.items[index],
                    );
                  }
                },
                itemCount: wordModel.hasMoreData
                    ? wordModel.itemCount + 1
                    : wordModel.itemCount,
                physics: const ClampingScrollPhysics(),
              )),
            ]),
          );
        });
  }
}
