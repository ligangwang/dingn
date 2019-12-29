import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/number/number_model.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/widgets/hyperlink.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';


class NumberDetailScreen extends ProviderScreen {
  const NumberDetailScreen();

  @override
  Widget build(BuildContext context) {
    final numberModel = Provider.of<NumberModel>(context);
    final number = numberModel.activeItem;
    final sortedWords = List<String>.from(number.words)..sort();
    final index = numberModel.activeIndex;
    return Center(
      child: Container(
        child: CustomScrollView(
          slivers: <Widget>[
            SliverAppBar(
              pinned: true,
              floating: true,
              snap: false,
              expandedHeight: 100.0,
              backgroundColor: const Color.fromRGBO(0, 0, 0, 0.0),
              flexibleSpace: FlexibleSpaceBar(
                title: Tooltip(
                  message: majorSystem,
                  child: Text('${number.number}-${number.favoriteWord ?? ''}', style: const TextStyle(color:AppTheme.accentColor, fontSize: AppTheme.fontSizeMedium)),
                ),
                centerTitle: true,
              ),
              actions: <Widget>[
                FlatButton(
                  onPressed: index <= 0 ? null : ()=>numberModel.items[index - 1],
                  child: Column(
                    children: const <Widget>[
                      Icon(Icons.navigate_before, color: AppTheme.accentColor),
                      Text('prev')
                    ],
                  )
                ),
                FlatButton(
                  onPressed: index >= numberModel.items.length - 1 ? null : ()=>numberModel.items[index + 1],
                  child: Column(
                    children: const <Widget>[
                      Icon(Icons.navigate_next, color: AppTheme.accentColor),
                      Text('next')
                    ],
                  )
                  
                ),
              ]                                                    
            ),
            if (number.number != null)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (BuildContext context, int index) {
                    return Center(
                      child: ListTile(
                        title: Text('${sortedWords[index]}'), 
                        leading: IconButton(
                          icon: Icon(Icons.favorite),
                          color: number.myFavoriteWord == sortedWords[index] ? Colors.redAccent: Colors.grey,
                          onPressed: (){
                            if (sortedWords[index] != number.myFavoriteWord){
                              //BlocProvider.of<NumberDetailBloc>(context).add(SetFavoriteDataEvent(state.number, sortedWords[index]));
                              //BlocProvider.of<NumberBloc>(context).add(SetFavoriteDataEvent(state.number, sortedWords[index]));
                            }
                          },
                        ),
                        trailing: null,
                        subtitle: Hyperlink(text:'https://en.wiktionary.org/wiki/${sortedWords[index]}', url:'https://en.wiktionary.org/wiki/${sortedWords[index]}')
                      )
                    );
                  },
                  childCount: sortedWords.length,
                ),
              ),
          ],
        ),
      ),
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

