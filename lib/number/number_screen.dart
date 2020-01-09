import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/widgets/loading.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

final String majorSystem = majorSystemDigits.join('  ');

class NumberScreen extends StatelessWidget {
  void onAction(BuildContext context, String digits){
    final numberModel = Provider.of<NumberModel>(context);
    numberModel.setActiveKey(digits);
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    return ProviderScreen<NumberModel>(
      name: '/number',
      modelBuilder: ()=>NumberModel(accountModel, 1),
      builder: (context, NumberModel numberModel, _){
        return Container(
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(children: <Widget>[
                  IconButton(
                    icon: const Icon(Icons.looks_one),
                    tooltip: '1 digits',
                    onPressed: (){onAction(context, '1');},
                    color: numberModel.activeKey == '1'? Colors.grey:Colors.redAccent
                  ),
                  IconButton(
                    icon: const Icon(Icons.looks_two),
                    tooltip: '2 digits',
                    onPressed: (){onAction(context, '2');},
                    color: numberModel.activeKey == '2'? Colors.grey:Colors.redAccent
                  ),
                  IconButton(
                    icon: const Icon(Icons.looks_3),
                    tooltip: '3 digits',
                    onPressed: (){onAction(context, '3');},
                    color: numberModel.activeKey == '3'? Colors.grey:Colors.redAccent
                  ),
                  IconButton(
                    icon: const Icon(Icons.looks_4),
                    tooltip: '4 digits',
                    onPressed: (){onAction(context, '4');},
                    color: numberModel.activeKey == '4'? Colors.grey:Colors.redAccent
                  ),

              ]),
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
                      );
                    }
                  },
                  itemCount: numberModel.hasMoreData? numberModel.itemCount + 1: numberModel.itemCount,
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

