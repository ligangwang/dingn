import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/playing_card/playing_card_numbers.dart';
import 'package:dingn/utils/extensions.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

final String majorSystem = majorSystemDigits.join('  ');

class PlayingCardScreen extends StatefulWidget {
  @override
  _PlayingCardState createState() => _PlayingCardState();
}

class _PlayingCardState extends State<PlayingCardScreen> {
  final PageController _pageController =
      PageController(initialPage: 0, keepPage: true);
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void shuffleItems(NumberModel numberModel) {
    numberModel
        .setPresetItemKeys(shuffle(List<String>.from(playingCardNumbers)));
    _pageController.jumpToPage(0);
  }

  void unshuffleItems(NumberModel numberModel) {
    numberModel.setPresetItemKeys(List<String>.from(playingCardNumbers));
    _pageController.jumpToPage(0);
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
    final accountModel = provider.Provider.of<AccountModel>(context);
    return ProviderScreen<NumberModel>(
        name: '/card',
        modelBuilder: () => NumberModel(
            accountModel: accountModel,
            requestBatchSize: 1,
            presetItemKeys: playingCardNumbers),
        builder: (context, NumberModel numberModel, _) {
          return Container(
              padding: const EdgeInsets.all(10),
              child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
                Row(children: <Widget>[
                  IconButton(
                      icon: const Icon(Icons.shuffle),
                      tooltip: 'random shuffle',
                      onPressed: () => shuffleItems(numberModel),
                      color: Colors.redAccent),
                  IconButton(
                      icon: const Icon(Icons.reset_tv),
                      tooltip: 'unshuffle/reset',
                      onPressed: () => unshuffleItems(numberModel),
                      color: Colors.redAccent),
                  Expanded(
                    child: Row(
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
                  ),
                ]),
                Expanded(
                  child: PageView.builder(
                    scrollDirection: Axis.horizontal,
                    controller: _pageController,
                    itemBuilder: (context, index) {
                      numberModel.activeIndex = index;
                      if (index >= numberModel.itemCount) {
                        if (index == numberModel.itemCount)
                          numberModel.loadData();
                        return Loading();
                      } else {
                        final Number number = numberModel.items[index];
                        return NumberCard(
                          number: number,
                          onFavorite: (item) => numberModel.setMyFavoriteWord(
                              number.number, item),
                          alwaysShowTwoSides: true,
                          front: Image(
                            image: AssetImage(
                                'assets/images/cards/${playingNumberToCard[number.number]}.png'),
                            fit: BoxFit.contain,
                          ),
                        );
                      }
                    },
                    itemCount: playingCardNumbers.length,
                    physics: const ClampingScrollPhysics(),
                  ),
                ),
              ]));
        });
  }
}
