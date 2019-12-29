import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/number/number_card.dart';
import 'package:dingn/widgets/load_more_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

final String majorSystem = majorSystemDigits.join('  ');

class NumberScreen extends StatelessWidget {

  void _fetchData(BuildContext context){
    final numberModel = Provider.of<NumberModel>(context);
    numberModel.loadData();
  }

  void onAction(BuildContext context, int digits){
    final numberModel = Provider.of<NumberModel>(context);
    numberModel.setDigits(digits);
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    return ProviderScreen<NumberModel>(
      modelBuilder: ()=>NumberModel(accountModel, 10),
      builder: (context, NumberModel numberModel, _){
        return Center(
          child: Container(
            child: CustomScrollView(
              slivers: <Widget>[
                SliverAppBar(
                  expandedHeight: 100.0,
                  backgroundColor: const Color.fromRGBO(0, 0, 0, 0.0),
                  flexibleSpace: FlexibleSpaceBar(
                    title: Tooltip(
                      message: majorSystem,
                      child: const Text('Mnemonic Major System', style: TextStyle(color:AppTheme.accentColor, fontSize: 12)),
                    ),
                    centerTitle: true,
                ),
                  actions: <Widget>[
                    IconButton(
                      icon: const Icon(Icons.looks_one),
                      tooltip: '1 digits',
                      onPressed: (){onAction(context, 1);},
                      color: numberModel.activeDigits == 1? Colors.grey:Colors.redAccent
                    ),
                    IconButton(
                      icon: const Icon(Icons.looks_two),
                      tooltip: '2 digits',
                      onPressed: (){onAction(context, 2);},
                      color: numberModel.activeDigits == 2? Colors.grey:Colors.redAccent
                    ),
                    IconButton(
                      icon: const Icon(Icons.looks_3),
                      tooltip: '3 digits',
                      onPressed: (){onAction(context, 3);},
                      color: numberModel.activeDigits == 3? Colors.grey:Colors.redAccent
                    ),
                    IconButton(
                      icon: const Icon(Icons.looks_4),
                      tooltip: '4 digits',
                      onPressed: (){onAction(context, 4);},
                      color: numberModel.activeDigits == 4? Colors.grey:Colors.redAccent
                    ),
                  ]
                ),
                if (numberModel.state == ModelState.Done)
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        if (index>=numberModel.items.length){
                          print('loading numbers: $index, ${numberModel.items.length}');
                          _fetchData(context);
                          return LoadMoreWidget();
                        }
                        return NumberCard(
                          key: Key(numberModel.items[index].number),
                          numbers: numberModel.items,
                          itemIndex: index,
                        );
                      },
                      childCount: numberModel.hasMoreData ? numberModel.items.length + 1 : numberModel.items.length,
                    ),
                    // gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    //   maxCrossAxisExtent: 300,
                    //   childAspectRatio: 3 / 2
                    // )
                  ),
                if (numberModel.state == ModelState.Progress)
                  const SliverToBoxAdapter(
                    child:
                      Center(child: CircularProgressIndicator())),
              ],
            ),
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

