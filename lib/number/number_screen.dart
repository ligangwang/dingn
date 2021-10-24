import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

final String majorSystem = majorSystemDigits.join('  ');

class NumberScreen extends StatefulWidget {
  @override
  _NumberScreenState createState() => _NumberScreenState();
}

class _NumberScreenState extends State<NumberScreen> {
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

  void clickDigits(BuildContext context, String digits) {
    final numberModel =
        provider.Provider.of<NumberModel>(context, listen: false);
    numberModel.setActiveKey(digits);
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    return ProviderScreen<NumberModel>(
        name: '/number',
        modelBuilder: () =>
            NumberModel(accountModel: accountModel, requestBatchSize: 1),
        builder: (context, NumberModel numberModel, _) {
          return Container(
              padding: const EdgeInsets.all(10),
              child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
                Row(children: <Widget>[
                  IconButton(
                      icon: const Icon(Icons.looks_one),
                      tooltip: '1 digit',
                      onPressed: () {
                        clickDigits(context, '1');
                      },
                      color: numberModel.activeKey == '1'
                          ? Colors.grey
                          : Colors.redAccent),
                  IconButton(
                      icon: const Icon(Icons.looks_two),
                      tooltip: '2 digits',
                      onPressed: () {
                        clickDigits(context, '2');
                      },
                      color: numberModel.activeKey == '2'
                          ? Colors.grey
                          : Colors.redAccent),
                  IconButton(
                      icon: const Icon(Icons.looks_3),
                      tooltip: '3 digits',
                      onPressed: () {
                        clickDigits(context, '3');
                      },
                      color: numberModel.activeKey == '3'
                          ? Colors.grey
                          : Colors.redAccent),
                  IconButton(
                      icon: const Icon(Icons.looks_4),
                      tooltip: '4 digits',
                      onPressed: () {
                        clickDigits(context, '4');
                      },
                      color: numberModel.activeKey == '4'
                          ? Colors.grey
                          : Colors.redAccent),
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
                        numberModel.loadData();
                        return Loading();
                      } else {
                        final Number number = numberModel.items[index];
                        return NumberCard(
                          number: number,
                          onFavorite: (item) => numberModel.setMyFavoriteWord(
                              number.number, item),
                          alwaysShowTwoSides: false,
                        );
                      }
                    },
                    itemCount: numberModel.hasMoreData
                        ? numberModel.itemCount + 1
                        : numberModel.itemCount,
                    physics: const ClampingScrollPhysics(),
                  ),
                ),
              ]));
        });
  }
}
