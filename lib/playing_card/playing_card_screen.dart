import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/playing_card/playing_card_numbers.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

final String majorSystem = majorSystemDigits.join('  ');

class PlayingCardScreen extends StatelessWidget {
  void onAction(BuildContext context, String digits){
    final numberModel = Provider.of<NumberModel>(context);
    numberModel.setActiveKey(digits);
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    return ProviderScreen<NumberModel>(
      name: '/card',
      modelBuilder: ()=>NumberModel(accountModel: accountModel, requestBatchSize: 1, presetItemKeys: playingCardNumbers),
      builder: (context, NumberModel numberModel, _){
        return Container(
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Expanded(
                child:
                PageView.builder(
                  scrollDirection: Axis.horizontal,
                  itemBuilder: (context, index){
                    numberModel.activeIndex = index;
                    if (index>=numberModel.itemCount){
                      numberModel.loadData();
                      return Loading();
                    }else{
                      final number = numberModel.items[index];
                      return NumberCard(
                        number: number,
                        onFavorite: (item)=>numberModel.setMyFavoriteWord(number.number, item),
                        alwaysShowTwoSides: true,
                        front: Image(
                          image: AssetImage('assets/images/cards/${playingNumberToCard[number.number]}.png'),
                          fit: BoxFit.contain,
                        ),
                      );
                    }
                  },
                  itemCount: playingCardNumbers.length,
                  physics: const ClampingScrollPhysics(),
                ),
              ),
            ]
          )
        );    
      }
    );
  }
}

