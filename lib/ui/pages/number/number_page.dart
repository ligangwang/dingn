import 'package:after_layout/after_layout.dart';
import 'package:dingn/blocs/number/bloc.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/ui/widgets/common/load_more.dart';
import 'package:dingn/ui/widgets/number_card/number_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';

const List<String> major_system_digits = [
  '0 - /s/, /z/',
  '1 - /t/, /d/',
  '2 - /n/',
  '3 - /m/',
  '4 - /r/',
  '5 - /l/',
  '6 - /tʃ/, /dʒ/, /ʃ/, /ʒ/',
  '7 - /k/, /ɡ/',
  '8 - /f/, /v/',
  '9 - /p/, /b/'
];
final String majorSystem = major_system_digits.join('  ');

class NumberPage extends StatefulWidget {
  @override
  _NumberPageState createState() => _NumberPageState();
}


class _NumberPageState extends State<NumberPage> with AfterLayoutMixin, TickerProviderStateMixin{

  void _fetchData(){
    BlocProvider.of<NumberBloc>(context).add(FetchDataEvent());
  }

  void onAction(int digits){
    BlocProvider.of<NumberBloc>(context).add(ChangeDigitDataEvent(digits));
  }

  @override
  void afterFirstLayout(BuildContext context){
    _fetchData();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
        children: <Widget>[
          BlocListener<AuthenticationBloc, AuthenticationState>(
            listener: (BuildContext context, AuthenticationState state) {
            },
            child: BlocBuilder<NumberBloc, NumberDataState>(
              builder: (BuildContext context, NumberDataState state) {
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
                              child: const Text('Major System', style: TextStyle(color:AppTheme.accentColor, fontSize: AppTheme.fontSizeMedium)),
                            ),
                            centerTitle: true,
                        ),
                          actions: <Widget>[
                            IconButton(
                              icon: const Icon(Icons.looks_one),
                              tooltip: '1 digits',
                              onPressed: (){onAction(1);},
                            ),
                            IconButton(
                              icon: const Icon(Icons.looks_two),
                              tooltip: '2 digits',
                              onPressed: (){onAction(2);},
                            ),
                            IconButton(
                              icon: const Icon(Icons.looks_3),
                              tooltip: '3 digits',
                              onPressed: (){onAction(3);},
                            ),
                            IconButton(
                              icon: const Icon(Icons.looks_4),
                              tooltip: '4 digits',
                              onPressed: (){onAction(4);},
                            ),
                          ]                                                    
                        //   bottom: 
                        //     TabBar(
                        //       controller: _tabController,
                        //       indicatorColor: Colors.teal,
                        //       labelColor: Colors.teal,
                        //       unselectedLabelColor: Colors.black54,
                        //       tabs: <Widget>[
                        //         //Tab(icon: Icon(Icons.looks_one), text: '1 digit'),
                        //         //Tab(icon: Icon(Icons.looks_two), text: '2 digits'),
                        //         Tab(icon: Icon(Icons.looks_3), text: '3 digit'),
                        //         //Tab(icon: Icon(Icons.looks_4), text: '4 digits'),
                        //       ],
                        //     ),
                        ),
                        if (state.activeState.state == DataState.Loaded)
                          SliverGrid(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                if (index>=state.activeState.items.length){
                                  _fetchData();
                                  return LoadMore();
                                }
                                return NumberCard(
                                  key: Key(state.activeState.items[index].number),
                                  numbers: state.activeState.items,
                                  itemIndex: index,
                                );
                              },
                              childCount: state.activeState.hasMoreData ? state.activeState.items.length + 1 : state.activeState.items.length,
                            ),
                            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 300,
                              childAspectRatio: 3 / 2
                            )
                          ),
                        if (state.activeState.state == DataState.Loading)
                          const SliverToBoxAdapter(
                              child:
                                  Center(child: CircularProgressIndicator())),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
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

